import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { dateOnly, isoDate, todayInIndia } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { NumberSeriesService } from '../number-series/number-series.service.js';
import { liveGodown } from '../purchases/purchase-context.js';
import { settledOf } from '../settlements/settlements.service.js';
import { lockUntouchedBatches } from '../stock-moves/stock-move-draws.js';
import type { CreateCreditNoteDto } from './dto/note.dto.js';
import { customerOwes } from '../invoices/invoice-rules.js';
import { creditNotePartyAmount } from './note-credit.js';
import { noteDateProblem, noteLineFigures, noteTotals, settleOnDocument, splitOf, withoutGstProblem, type NoteLineFigures } from './note-rules.js';
import { creditUsedElsewhere } from './note-allocations.service.js';
import { creditNoteInclude, toCreditNoteView, type CreditNoteView } from './note-views.js';

type Tx = Prisma.TransactionClient;
const n = (value: Prisma.Decimal | null) => toNumber(value) ?? 0;
const fail = (message: string | null) => {
  if (message) throw new BadRequestException(message);
};

/** What live credit notes already took off each invoice line. */
async function notedOnInvoiceLines(tx: Tx, invoiceId: string) {
  const rows = await tx.creditNoteLine.groupBy({
    by: ['invoiceLineId'],
    where: { creditNote: { invoiceId, cancelledAt: null } },
    _sum: { quantity: true, taxable: true },
  });
  return new Map(rows.map((row) => [row.invoiceLineId, { quantity: n(row._sum.quantity), taxable: n(row._sum.taxable) }]));
}

// Credit notes against issued invoices (client, 12 Nov 2026; note-rules.ts).
// Saved in one transaction with the invoice row locked, so two notes on one
// invoice never both take what is left.
@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
  ) {}

  async list(): Promise<CreditNoteView[]> {
    const rows = await this.prisma.creditNote.findMany({ include: creditNoteInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(toCreditNoteView);
  }

  async get(id: string): Promise<CreditNoteView> {
    return toCreditNoteView(await this.prisma.creditNote.findUniqueOrThrow({ where: { id }, include: creditNoteInclude }));
  }

  create(dto: CreateCreditNoteDto, userId: string): Promise<CreditNoteView> {
    return this.prisma.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Invoice" WHERE "id" = ${dto.invoiceId}::uuid FOR UPDATE`;
        if (!locked) fail('That invoice does not exist');
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: dto.invoiceId },
          select: {
            number: true,
            date: true,
            status: true,
            partyId: true,
            regime: true,
            cgst: true,
            sgst: true,
            igst: true,
            tax: true,
            total: true,
            lines: { select: { id: true, itemId: true, quantity: true, freeQuantity: true, taxable: true, gstRatePct: true, costOfGoods: true, item: { select: { name: true } } } },
          },
        });
        if (invoice.status !== 'ISSUED') fail(`Invoice ${invoice.number} is cancelled; a note needs an issued invoice`);

        const goods = dto.reason === 'GOODS_RETURNED';
        if (goods && dto.lines.some((line) => !(line.quantity && line.quantity > 0))) fail('Goods returned: enter the quantity that came back on every line');
        if (!goods && dto.lines.some((line) => line.quantity && line.quantity > 0)) fail('Only a note for goods returned brings stock back; enter amounts for this reason');
        if (goods) {
          if (!dto.godownId) fail('Pick the godown the goods came back into');
          await liveGodown(tx, dto.godownId!);
        }

        const noted = await notedOnInvoiceLines(tx, dto.invoiceId);
        // A note without GST leaves the tax alone: every line at no GST.
        const gstAdjusted = dto.gstAdjusted ?? true;
        fail(withoutGstProblem(gstAdjusted, dto.reason));
        fail(noteDateProblem(dto.date, isoDate(invoice.date), todayInIndia(), gstAdjusted && n(invoice.tax) > 0));
        const split = gstAdjusted ? splitOf({ cgst: n(invoice.cgst), sgst: n(invoice.sgst), igst: n(invoice.igst) }) : 'NONE';
        const seen = new Set<string>();
        const figures: (NoteLineFigures & { invoiceLineId: string; itemId: string })[] = [];
        for (const input of dto.lines) {
          const line = invoice.lines.find((candidate) => candidate.id === input.invoiceLineId);
          if (!line) fail('A line is not on this invoice');
          if (seen.has(line!.id)) fail('Each invoice line goes on the note once');
          seen.add(line!.id);
          const sold = n(line!.quantity);
          // Free units drew stock too, so the cost per unit spreads over them.
          const drawn = sold + n(line!.freeQuantity);
          const result = noteLineFigures(
            {
              label: line!.item.name,
              quantity: sold,
              taxable: n(line!.taxable),
              gstRatePct: n(line!.gstRatePct),
              unitCost: drawn > 0 ? n(line!.costOfGoods) / drawn : 0,
              notedQuantity: noted.get(line!.id)?.quantity ?? 0,
              notedTaxable: noted.get(line!.id)?.taxable ?? 0,
            },
            input,
            split,
          );
          if (typeof result === 'string') fail(result);
          figures.push({ ...(result as NoteLineFigures), invoiceLineId: line!.id, itemId: line!.itemId });
        }
        const totals = noteTotals(figures);
        // The note settles the invoice up to what is still due on it; the rest is the customer's credit (note-credit.ts).
        const paid = (await settledOf(tx, [{ kind: 'INVOICE', id: dto.invoiceId }])).get(dto.invoiceId) ?? 0;
        const stillDue = Math.round((customerOwes({ regime: invoice.regime, total: n(invoice.total), igst: n(invoice.igst) }) - paid) * 100) / 100;
        const { onDocument } = settleOnDocument(creditNotePartyAmount({ regime: invoice.regime, total: totals.total, igst: totals.igst }), stillDue);

        const claimed = await this.numbers.issue(tx, 'CREDIT_NOTE', dto.date, { typed: dto.number ?? undefined });
        const note = await tx.creditNote.create({
          data: {
            number: claimed.number,
            issuedNumberId: claimed.id,
            date: dateOnly(dto.date),
            invoiceId: dto.invoiceId,
            partyId: invoice.partyId,
            godownId: goods ? dto.godownId! : null,
            reason: dto.reason,
            gstAdjusted,
            regime: invoice.regime,
            taxable: totals.taxable,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            tax: totals.tax,
            roundOff: totals.roundOff,
            total: totals.total,
            cost: totals.cost,
            notes: dto.notes ?? null,
            createdById: userId,
            lines: {
              create: figures.map((line, position) => ({
                position,
                invoiceLineId: line.invoiceLineId,
                itemId: line.itemId,
                quantity: line.quantity,
                taxable: line.taxable,
                gstRatePct: invoice.lines.find((candidate) => candidate.id === line.invoiceLineId)!.gstRatePct,
                tax: line.tax,
                cost: line.cost,
              })),
            },
          },
          select: { id: true, lines: { select: { id: true, position: true, itemId: true } } },
        });
        if (goods) {
          // The goods come back as a batch at the cost they left at, dated the note.
          await tx.stockBatch.createMany({
            data: note.lines.map((line) => {
              const figure = figures[line.position];
              return {
                itemId: line.itemId,
                godownId: dto.godownId!,
                creditNoteLineId: line.id,
                date: dateOnly(dto.date),
                quantity: figure.quantity,
                remaining: figure.quantity,
                landedRate: Math.round((figure.cost / figure.quantity) * 10_000) / 10_000,
              };
            }),
          });
        }
        if (onDocument > 0) await tx.noteAllocation.create({ data: { creditNoteId: note.id, invoiceId: dto.invoiceId, amount: onDocument } });
        await tx.issuedNumber.update({ where: { id: claimed.id }, data: { documentId: note.id } });
        return toCreditNoteView(await tx.creditNote.findUniqueOrThrow({ where: { id: note.id }, include: creditNoteInclude }));
      },
      { timeout: 20_000 },
    );
  }

  /** The note stops counting; goods it brought back leave again (only while untouched); the number is cancelled. */
  cancel(id: string, reason: string): Promise<CreditNoteView> {
    return this.prisma.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<{ cancelledAt: Date | null; issuedNumberId: string }[]>`
        SELECT "cancelledAt", "issuedNumberId" FROM "CreditNote" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!current) fail('That credit note does not exist');
      if (current.cancelledAt) throw new ConflictException('This credit note is already cancelled');
      const used = await creditUsedElsewhere(tx, 'CREDIT_NOTE', id);
      if (used.length) throw new ConflictException(`This note's credit was refunded by ${used.join(', ')}. Cancel the refund first.`);
      const lines = await tx.creditNoteLine.findMany({ where: { creditNoteId: id }, select: { id: true } });
      if (lines.length) {
        const batchIds = await lockUntouchedBatches(
          tx,
          Prisma.sql`"creditNoteLineId" IN (${Prisma.join(lines.map((line) => Prisma.sql`${line.id}::uuid`))})`,
          'Some of the goods it brought back have been sold or moved since, so it cannot be cancelled',
        );
        if (batchIds.length) await tx.stockBatch.deleteMany({ where: { id: { in: batchIds } } });
      }
      await this.numbers.cancel(tx, current.issuedNumberId);
      const row = await tx.creditNote.update({ where: { id }, data: { cancelledAt: new Date(), cancelReason: reason }, include: creditNoteInclude });
      return toCreditNoteView(row);
    });
  }
}
