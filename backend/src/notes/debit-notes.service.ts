import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { dateOnly, isoDate, todayInIndia } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NumberSeriesService } from '../number-series/number-series.service.js';
import { settledOf } from '../settlements/settlements.service.js';
import type { CreateDebitNoteDto } from './dto/note.dto.js';
import { noteDateProblem, noteLineFigures, noteTotals, settleOnDocument, splitOf, withoutGstProblem, type NoteLineFigures } from './note-rules.js';
import { creditUsedElsewhere } from './note-allocations.service.js';
import { debitNoteInclude, toDebitNoteView, type DebitNoteView } from './note-views.js';
import { lockRows } from '../database/sql.js';

const n = (value: Prisma.Decimal | null) => toNumber(value) ?? 0;
const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

// Debit notes to vendors against open goods bills (client, 12 Nov 2026;
// note-rules.ts). Goods sent back leave the bill line's own batch (locked),
// so they can only go back while that stock is still here. A reverse-charge
// bill takes no note: the tax is ours, not the vendor's.
@Injectable()
export class DebitNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
  ) {}

  async list(): Promise<DebitNoteView[]> {
    const rows = await this.prisma.debitNote.findMany({ include: debitNoteInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(toDebitNoteView);
  }

  async get(id: string): Promise<DebitNoteView> {
    return toDebitNoteView(await this.prisma.debitNote.findUniqueOrThrow({ where: { id }, include: debitNoteInclude }));
  }

  create(dto: CreateDebitNoteDto, userId: string): Promise<DebitNoteView> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockRows(tx, 'PurchaseBill', dto.billId);
        const locked = (await tx.purchaseBill.findUnique({ where: { id: dto.billId }, select: { id: true } }))!;
        if (!locked) fail('That bill does not exist');
        const bill = await tx.purchaseBill.findUniqueOrThrow({
          where: { id: dto.billId },
          select: {
            reference: true,
            date: true,
            status: true,
            kind: true,
            vendorId: true,
            regime: true,
            cgst: true,
            sgst: true,
            igst: true,
            itcClaimable: true,
            payable: true,
            lines: {
              select: { id: true, itemId: true, quantity: true, taxable: true, gstRatePct: true, itcEligible: true, item: { select: { name: true } }, batch: { select: { id: true, landedRate: true } } },
            },
          },
        });
        if (bill.status !== 'OPEN') fail(`Bill ${bill.reference} is void; a note needs an open bill`);
        if (bill.kind !== 'GOODS') fail('A debit note is for goods bills; correct a charges bill by voiding it');
        if (bill.regime === 'REVERSE_CHARGE') fail('A reverse-charge bill takes no debit note: the GST on it is ours to pay');

        const goods = dto.reason === 'GOODS_RETURNED';
        if (goods && dto.lines.some((line) => !(line.quantity && line.quantity > 0))) fail('Goods sent back: enter the quantity on every line');
        if (!goods && dto.lines.some((line) => line.quantity && line.quantity > 0)) fail('Only a note for goods sent back moves stock; enter amounts for this reason');
        fail(noteDateProblem(dto.date, isoDate(bill.date), todayInIndia(), false));

        const notedRows = await tx.debitNoteLine.groupBy({
          by: ['billLineId'],
          where: { debitNote: { billId: dto.billId, cancelledAt: null } },
          _sum: { quantity: true, taxable: true },
        });
        const noted = new Map(notedRows.map((row) => [row.billLineId, { quantity: n(row._sum.quantity), taxable: n(row._sum.taxable) }]));
        // A note without GST leaves the tax alone: every line at no GST.
        const gstAdjusted = dto.gstAdjusted ?? true;
        fail(withoutGstProblem(gstAdjusted, dto.reason));
        const split = gstAdjusted ? splitOf({ cgst: n(bill.cgst), sgst: n(bill.sgst), igst: n(bill.igst) }) : 'NONE';
        // Credit given back only when the note touches GST.
        const credited = gstAdjusted && n(bill.itcClaimable) > 0;
        const seen = new Set<string>();
        const figures: (NoteLineFigures & { billLineId: string; itemId: string; itcEligible: boolean; batchId: string | null })[] = [];
        for (const input of dto.lines) {
          const line = bill.lines.find((candidate) => candidate.id === input.billLineId);
          if (!line) fail('A line is not on this bill');
          if (seen.has(line!.id)) fail('Each bill line goes on the note once');
          seen.add(line!.id);
          const result = noteLineFigures(
            {
              label: line!.item.name,
              quantity: n(line!.quantity),
              taxable: n(line!.taxable),
              gstRatePct: n(line!.gstRatePct),
              unitCost: n(line!.batch?.landedRate ?? null),
              notedQuantity: noted.get(line!.id)?.quantity ?? 0,
              notedTaxable: noted.get(line!.id)?.taxable ?? 0,
            },
            input,
            split,
          );
          if (typeof result === 'string') fail(result);
          const figure = result as NoteLineFigures;
          let batchId: string | null = null;
          if (figure.quantity > 0) {
            if (!line!.batch) fail(`${line!.item.name}: this bill's stock is not on record`);
            // The goods leave this bill's own batch, locked so a sale cannot take them meanwhile.
            await lockRows(tx, 'StockBatch', line!.batch!.id);
            const batch = await tx.stockBatch.findUniqueOrThrow({ where: { id: line!.batch!.id }, select: { remaining: true } });
            const left = n(batch.remaining);
            if (left < figure.quantity) fail(`${line!.item.name}: only ${left} from this bill is still in stock; the rest has been sold or moved`);
            await tx.stockBatch.update({ where: { id: line!.batch!.id }, data: { remaining: { decrement: figure.quantity } } });
            batchId = line!.batch!.id;
          }
          figures.push({ ...figure, billLineId: line!.id, itemId: line!.itemId, itcEligible: line!.itcEligible, batchId });
        }
        const totals = noteTotals(figures);
        // The credit taken on these lines goes back; GST that was cost goes back as cost.
        const itcReversed = credited ? Math.round(figures.filter((line) => line.itcEligible).reduce((sum, line) => sum + line.tax, 0) * 100) / 100 : 0;
        const paid = (await settledOf(tx, [{ kind: 'BILL', id: dto.billId }])).get(dto.billId) ?? 0;
        // The note settles the bill up to what we still owe on it; the rest is the vendor's credit with us (note-credit.ts).
        const { onDocument } = settleOnDocument(totals.total, Math.round((n(bill.payable) - paid) * 100) / 100);

        const claimed = await this.numbers.issue(tx, 'DEBIT_NOTE', dto.date, { typed: dto.number ?? undefined });
        const note = await tx.debitNote.create({
          data: {
            number: claimed.number,
            issuedNumberId: claimed.id,
            date: dateOnly(dto.date),
            billId: dto.billId,
            partyId: bill.vendorId,
            reason: dto.reason,
            gstAdjusted,
            taxable: totals.taxable,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            tax: totals.tax,
            itcReversed: Math.min(itcReversed, totals.tax),
            roundOff: totals.roundOff,
            total: totals.total,
            cost: totals.cost,
            notes: dto.notes ?? null,
            createdById: userId,
            lines: {
              create: figures.map((line, position) => ({
                position,
                billLineId: line.billLineId,
                itemId: line.itemId,
                quantity: line.quantity,
                taxable: line.taxable,
                gstRatePct: bill.lines.find((candidate) => candidate.id === line.billLineId)!.gstRatePct,
                tax: line.tax,
                itcEligible: line.itcEligible,
                cost: line.cost,
                batchId: line.batchId,
              })),
            },
          },
          include: debitNoteInclude,
        });
        if (onDocument > 0) await tx.noteAllocation.create({ data: { debitNoteId: note.id, billId: dto.billId, amount: onDocument } });
        await tx.issuedNumber.update({ where: { id: claimed.id }, data: { documentId: note.id } });
        return toDebitNoteView(await tx.debitNote.findUniqueOrThrow({ where: { id: note.id }, include: debitNoteInclude }));
      },
      { timeout: 20_000 },
    );
  }

  /** The note stops counting; goods it sent back return to their batch; the number is cancelled. */
  cancel(id: string, reason: string): Promise<DebitNoteView> {
    return this.prisma.$transaction(async (tx) => {
      await lockRows(tx, 'DebitNote', id);
      const current = (await tx.debitNote.findUnique({ where: { id }, select: { cancelledAt: true, issuedNumberId: true } }))!;
      if (!current) fail('That debit note does not exist');
      if (current.cancelledAt) throw new ConflictException('This debit note is already cancelled');
      const used = await creditUsedElsewhere(tx, 'DEBIT_NOTE', id);
      if (used.length) throw new ConflictException(`This note's credit was refunded by ${used.join(', ')}. Cancel the refund first.`);
      const lines = await tx.debitNoteLine.findMany({ where: { debitNoteId: id, batchId: { not: null } }, select: { batchId: true, quantity: true }, orderBy: { batchId: 'asc' } });
      for (const line of lines) {
        await lockRows(tx, 'StockBatch', line.batchId!);
        await tx.stockBatch.update({ where: { id: line.batchId! }, data: { remaining: { increment: line.quantity } } });
      }
      await this.numbers.cancel(tx, current.issuedNumberId);
      const row = await tx.debitNote.update({ where: { id }, data: { cancelledAt: new Date(), cancelReason: reason }, include: debitNoteInclude });
      return toDebitNoteView(row);
    });
  }
}
