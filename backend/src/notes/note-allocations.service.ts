import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AllocationDto } from '../settlements/dto/settlement.dto.js';
import { allocationProblem } from '../settlements/settlement-rules.js';
import { SettlementsService } from '../settlements/settlements.service.js';
import { settlesOutstanding, type PartySide } from '../journals/journal-rules.js';
import { creditLeft, creditNotePartyAmount, debitNotePartyAmount, noteUsage, type NoteKind } from './note-credit.js';
import { lockRows } from '../database/sql.js';

type Tx = Prisma.TransactionClient;

const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

/** What each side's credit settles: what the customer owes (receivable) or what we owe the vendor (payable). */
const ALLOWED = {
  RECEIVABLE: ['INVOICE', 'OPENING', 'JOURNAL'],
  PAYABLE: ['BILL', 'EXPENSE', 'OPENING', 'JOURNAL'],
} as const satisfies Record<PartySide, readonly AllocationDto['kind'][]>;
/** The settlement direction whose targets a side's credit settles (and is checked like). */
const DIRECTION = { RECEIVABLE: 'RECEIPT', PAYABLE: 'PAYMENT' } as const;

/** One allocation as a row: from its source (note or journal line) to its target. */
export const creditAllocationData = (kind: NoteKind, sourceId: string, allocation: Pick<AllocationDto, 'kind' | 'documentId' | 'amount'>) => ({
  creditNoteId: kind === 'CREDIT_NOTE' ? sourceId : null,
  debitNoteId: kind === 'DEBIT_NOTE' ? sourceId : null,
  journalLineId: kind === 'JOURNAL' ? sourceId : null,
  invoiceId: allocation.kind === 'INVOICE' ? allocation.documentId : null,
  billId: allocation.kind === 'BILL' ? allocation.documentId : null,
  expenseId: allocation.kind === 'EXPENSE' ? allocation.documentId : null,
  openingPartyId: allocation.kind === 'OPENING' ? allocation.documentId : null,
  journalChargeId: allocation.kind === 'JOURNAL' ? allocation.documentId : null,
  amount: allocation.amount,
});

/**
 * Live refunds of a note's credit, by number: money went out (or came in)
 * against it, so the note is cancelled only after they are. Credit applied to
 * another document is not a block: cancelling the note reopens that document,
 * as cancelling a receipt reopens its invoices.
 */
export async function creditUsedElsewhere(tx: Tx, kind: 'CREDIT_NOTE' | 'DEBIT_NOTE', id: string): Promise<string[]> {
  const refunds = await tx.settlementAllocation.findMany({
    where: { ...(kind === 'CREDIT_NOTE' ? { creditNoteId: id } : { debitNoteId: id }), settlement: { cancelledAt: null } },
    select: { settlement: { select: { number: true } } },
  });
  return [...new Set(refunds.map((row) => row.settlement.number))];
}

// A note's credit (what it took off beyond what its own document still owed,
// client 13 Nov 2026) applied later to the same party's other invoices or
// bills, expenses bought on credit, or opening balance. Locks: the party, then
// the note, then the documents (settlements.service.ts targets), the order
// receipts and payments use. Nothing posts: the note already moved the
// party's ledger; this only says which document it settles.
@Injectable()
export class NoteAllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: SettlementsService,
  ) {}

  /**
   * Applies a credit to the party's open documents. `id` is the credit note,
   * the debit note, or the settling journal line (kind JOURNAL).
   */
  apply(kind: NoteKind, id: string, allocations: AllocationDto[]): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const owner =
        kind === 'CREDIT_NOTE'
          ? await tx.creditNote.findUnique({ where: { id }, select: { partyId: true } })
          : kind === 'DEBIT_NOTE'
            ? await tx.debitNote.findUnique({ where: { id }, select: { partyId: true } })
            : await tx.journalLine.findUnique({ where: { id }, select: { partyId: true } });
      if (!owner?.partyId) throw new NotFoundException(kind === 'JOURNAL' ? 'That journal line is not on a customer or vendor' : 'That note does not exist');
      const partyId = owner.partyId;
      await lockRows(tx, 'Party', partyId);
      const party = await tx.party.findUniqueOrThrow({ where: { id: partyId }, select: { isCustomer: true, isVendor: true, isArchived: true, openingBalance: true, openingBalanceSide: true } });
      let partyAmount: number;
      let side: PartySide;
      if (kind === 'CREDIT_NOTE') {
        await lockRows(tx, 'CreditNote', id);
        const note = await tx.creditNote.findUniqueOrThrow({ where: { id }, select: { cancelledAt: true, total: true, igst: true, regime: true } });
        if (note.cancelledAt) throw new ConflictException('This note is cancelled');
        partyAmount = creditNotePartyAmount(note);
        side = 'RECEIVABLE';
      } else if (kind === 'DEBIT_NOTE') {
        await lockRows(tx, 'DebitNote', id);
        const note = await tx.debitNote.findUniqueOrThrow({ where: { id }, select: { cancelledAt: true, total: true } });
        if (note.cancelledAt) throw new ConflictException('This note is cancelled');
        partyAmount = debitNotePartyAmount(note);
        side = 'PAYABLE';
      } else {
        await lockRows(tx, 'JournalLine', id);
        const found = await tx.journalLine.findUniqueOrThrow({ where: { id }, select: { partySide: true, debit: true, credit: true, journal: { select: { cancelledAt: true } } } });
        const line = { partySide: found.partySide as PartySide, debit: found.debit, credit: found.credit, cancelledAt: found.journal.cancelledAt };
        if (line.cancelledAt) throw new ConflictException('This journal is cancelled');
        side = line.partySide;
        const figures = { debit: line.debit.toNumber(), credit: line.credit.toNumber() };
        if (!settlesOutstanding(side, figures)) fail('This journal line adds a charge; it has no credit to apply');
        partyAmount = figures.debit || figures.credit;
      }
      if (allocations.length === 0) fail('Pick what to apply the credit to');
      if (allocations.some((allocation) => !(ALLOWED[side] as readonly string[]).includes(allocation.kind))) {
        fail(side === 'RECEIVABLE' ? 'This credit is applied to the customer’s invoices, journal charges or opening balance' : 'This credit is applied to the vendor’s bills, expenses on credit, journal charges or opening balance');
      }
      if (allocations.some((allocation) => allocation.kind === 'JOURNAL' && allocation.documentId === id)) fail('A journal line cannot settle itself');
      const free = creditLeft(partyAmount, (await noteUsage(tx, kind, [id])).get(id)!);
      const targets = await this.settlements.targets(tx, DIRECTION[side], partyId, party, allocations);
      fail(allocationProblem(targets, free));
      await tx.noteAllocation.createMany({ data: allocations.map((allocation) => creditAllocationData(kind, id, allocation)) });
    });
  }
}
