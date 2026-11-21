import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { dateOnly, todayInIndia } from '../common/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NumberSeriesService } from '../number-series/number-series.service.js';
import type { CreateJournalDto } from './dto/journal.dto.js';
import { creditAllocationData, NoteAllocationsService } from '../notes/note-allocations.service.js';
import type { AllocationDto } from '../settlements/dto/settlement.dto.js';
import { liveSettlementNumbers, SettlementsService } from '../settlements/settlements.service.js';
import { cashLimitProblem } from '../settlements/settlement-rules.js';
import { cashReceivedOn } from './journal-cash.js';
import { cashByParty, journalProblem, partySideOf, settlesOutstanding, totalsOf, type JournalLineInput, type PartySide } from './journal-rules.js';

interface PartyRow {
  id: string;
  displayName: string;
  isCustomer: boolean;
  isVendor: boolean;
  isArchived: boolean;
  openingBalance: Prisma.Decimal;
  openingBalanceSide: 'RECEIVABLE' | 'PAYABLE';
}
import { journalInclude, toJournalView, type JournalView } from './journal-views.js';

type Tx = Prisma.TransactionClient;

const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

/**
 * Every ledger the lines name, locked against archiving while the voucher
 * saves: live, and (for a general ledger) under a group: the Profit & Loss
 * A/c is closed by the books, never by hand. Returns which are bank or cash,
 * and which of those are cash books.
 */
async function checkLedgers(tx: Tx, all: CreateJournalDto['lines']): Promise<Map<string, { isMoney: boolean; isCash: boolean }>> {
  // Party lines are checked (and locked) on their own, before these.
  const lines = all.filter((line) => line.kind !== 'party');
  const ids = (kind: string) => [...new Set(lines.filter((line) => line.kind === kind).map((line) => line.id))];
  const [ledgers, heads, accounts] = await Promise.all([
    tx.ledger.findMany({ where: { id: { in: ids('ledger') } }, select: { id: true, name: true, isArchived: true, groupId: true } }),
    tx.accountHead.findMany({ where: { id: { in: ids('head') } }, select: { id: true, name: true, isArchived: true } }),
    tx.bankCashAccount.findMany({ where: { id: { in: ids('account') } }, select: { id: true, name: true, isArchived: true, kind: true } }),
  ]);
  const money = new Map<string, { isMoney: boolean; isCash: boolean }>();
  const found = [
    ...ledgers.map((row) => ({ key: `ledger:${row.id}`, ...row, money: false, cash: false })),
    ...heads.map((row) => ({ key: `head:${row.id}`, ...row, groupId: 'head', money: false, cash: false })),
    ...accounts.map((row) => ({ key: `account:${row.id}`, ...row, groupId: 'account', money: true, cash: row.kind === 'CASH' })),
  ];
  for (const line of lines) {
    const row = found.find((candidate) => candidate.key === `${line.kind}:${line.id}`);
    if (!row) fail('A ledger on the voucher no longer exists; pick it again');
    if (row!.isArchived) fail(`${row!.name} is archived; restore it first or pick another ledger`);
    if (!row!.groupId) fail(`${row!.name} is closed by the books themselves and cannot be journalled`);
    money.set(row!.key, { isMoney: row!.money, isCash: row!.cash });
  }
  return money;
}

// Journal vouchers (client, 12 Nov 2026): numbered from the JOURNAL series in
// the save's own transaction, posted to the books (books.service.ts) unless
// cancelled. Not edited: cancel and enter a new one, as with stock journals.
@Injectable()
export class JournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
    private readonly settlements: SettlementsService,
    private readonly credits: NoteAllocationsService,
  ) {}

  async list(): Promise<JournalView[]> {
    const rows = await this.prisma.journalVoucher.findMany({ include: journalInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(toJournalView);
  }

  async get(id: string): Promise<JournalView> {
    return toJournalView(await this.prisma.journalVoucher.findUniqueOrThrow({ where: { id }, include: journalInclude }));
  }

  create(dto: CreateJournalDto, userId: string): Promise<JournalView> {
    if (dto.date > todayInIndia()) fail('A journal cannot be dated after today');
    return this.prisma.$transaction(async (tx) => {
      // Parties first, in id order: the lock order receipts and payments use (party, then documents).
      const partyIds = [...new Set(dto.lines.filter((line) => line.kind === 'party').map((line) => line.id))].sort();
      const parties = partyIds.length
        ? await tx.$queryRaw<PartyRow[]>`
            SELECT "id", "displayName", "isCustomer", "isVendor", "isArchived", "openingBalance", "openingBalanceSide"
            FROM "Party" WHERE "id" = ANY(${partyIds}::uuid[]) ORDER BY "id" FOR UPDATE`
        : [];
      const sides = dto.lines.map((line, index) => {
        if (line.kind !== 'party') {
          if (line.partySide || line.against) fail(`Line ${index + 1}: only a customer or vendor line takes a side or a document`);
          return null;
        }
        const party = parties.find((candidate) => candidate.id === line.id);
        if (!party) fail(`Line ${index + 1}: that customer or vendor no longer exists; pick it again`);
        const side = partySideOf(party!, line.partySide);
        if (side !== 'RECEIVABLE' && side !== 'PAYABLE') fail(`Line ${index + 1}: ${side}`);
        if (line.against && !settlesOutstanding(side as PartySide, line)) {
          fail(`Line ${index + 1}: this line adds to what ${side === 'RECEIVABLE' ? `${party!.displayName} owes` : `we owe ${party!.displayName}`}; only a line that settles is set against a document`);
        }
        return side as PartySide;
      });
      const money = await checkLedgers(tx, dto.lines);
      const lines: JournalLineInput[] = dto.lines.map((line) => ({ kind: line.kind, id: line.id, debit: line.debit, credit: line.credit, isMoney: money.get(`${line.kind}:${line.id}`)?.isMoney ?? false }));
      fail(journalProblem(lines));
      // s.269ST: cash a party pays in here counts with what they paid in cash that day (receipts and other journals).
      const cash = cashByParty(dto.lines.map((line) => ({ kind: line.kind, id: line.id, debit: line.debit, credit: line.credit, isCash: money.get(`${line.kind}:${line.id}`)?.isCash ?? false })));
      for (const [partyId, flow] of cash) {
        if (!(flow.received > 0)) continue;
        const problem = cashLimitProblem('RECEIPT', 'CASH', flow.received, await cashReceivedOn(tx, partyId, dateOnly(dto.date)));
        if (problem) fail(`${parties.find((party) => party.id === partyId)!.displayName}: ${problem}`);
      }
      // Each settling line set against a document takes what is open on it, up to the line's amount; the rest stays as credit.
      const against = await Promise.all(
        dto.lines.map(async (line, index) => {
          if (!line.against) return null;
          const side = sides[index]!;
          const amount = line.debit || line.credit;
          const [target] = await this.settlements.targets(tx, side === 'RECEIVABLE' ? 'RECEIPT' : 'PAYMENT', line.id, parties.find((party) => party.id === line.id)!, [
            { kind: line.against.kind, documentId: line.against.documentId, amount },
          ]);
          const applied = Math.round(Math.min(amount, target.balance) * 100) / 100;
          if (!(applied > 0)) fail(`Line ${index + 1}: nothing is open on ${target.label}`);
          return { kind: line.against.kind, documentId: line.against.documentId, amount: applied };
        }),
      );
      const claimed = await this.numbers.issue(tx, 'JOURNAL', dto.date, { typed: dto.number ?? undefined });
      const journal = await tx.journalVoucher.create({
        data: {
          number: claimed.number,
          issuedNumberId: claimed.id,
          date: dateOnly(dto.date),
          narration: dto.narration ?? null,
          total: totalsOf(lines).debit,
          createdById: userId,
          lines: {
            create: dto.lines.map((line, position) => ({
              position,
              ledgerId: line.kind === 'ledger' ? line.id : null,
              headId: line.kind === 'head' ? line.id : null,
              accountId: line.kind === 'account' ? line.id : null,
              partyId: line.kind === 'party' ? line.id : null,
              partySide: sides[position],
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        include: journalInclude,
      });
      await tx.issuedNumber.update({ where: { id: claimed.id }, data: { documentId: journal.id } });
      const lineIds = new Map(journal.lines.map((line) => [line.position, line.id]));
      const credits = against.flatMap((allocation, position) => (allocation ? [creditAllocationData('JOURNAL', lineIds.get(position)!, allocation)] : []));
      if (!credits.length) return toJournalView(journal);
      await tx.noteAllocation.createMany({ data: credits });
      return toJournalView(await tx.journalVoucher.findUniqueOrThrow({ where: { id: journal.id }, include: journalInclude }));
    });
  }

  /** A settling party line's credit applied later to the party's open documents. */
  async applyCredit(id: string, lineId: string, allocations: AllocationDto[]): Promise<JournalView> {
    const line = await this.prisma.journalLine.findUnique({ where: { id: lineId }, select: { journalId: true } });
    if (!line || line.journalId !== id) throw new NotFoundException('That line is not on this journal');
    await this.credits.apply('JOURNAL', lineId, allocations);
    return this.get(id);
  }

  /** The voucher stops counting in the books; its number is cancelled, never given again. Credit its lines applied stops counting too. */
  cancel(id: string, reason: string): Promise<JournalView> {
    return this.prisma.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<{ cancelledAt: Date | null; issuedNumberId: string }[]>`
        SELECT "cancelledAt", "issuedNumberId" FROM "JournalVoucher" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!current) fail('That journal does not exist');
      if (current.cancelledAt) throw new ConflictException('This journal is already cancelled');
      // A charge on a party that money or credit has since settled stays until those are cancelled.
      const charges = await tx.journalLine.findMany({ where: { journalId: id, partyId: { not: null } }, select: { id: true } });
      for (const charge of charges) {
        const using = await liveSettlementNumbers(tx, { journalLineId: charge.id });
        if (using.length) throw new ConflictException(`What this journal charged is settled by ${using.join(', ')}. Cancel those first.`);
      }
      await this.numbers.cancel(tx, current.issuedNumberId);
      const row = await tx.journalVoucher.update({ where: { id }, data: { cancelledAt: new Date(), cancelReason: reason }, include: journalInclude });
      return toJournalView(row);
    });
  }
}
