import { Injectable } from '@nestjs/common';
import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { batchSourceSelect, drawSource, type DrawSource } from '../stock/draw-source.js';

const n = (value: Prisma.Decimal | null) => toNumber(value) ?? 0;
const qty = (value: number) => Math.round(value * 1000) / 1000;

/** One batch still in stock: where it came from, at what landed rate. */
export interface StockBatchView {
  batchId: string | null;
  source: DrawSource;
  /** The vendor on a bill; null for other sources. */
  vendor: string | null;
  date: string | null;
  godownId: string;
  godownName: string;
  remaining: number;
  landedRate: number;
}

export interface ItemStockDetailView {
  itemId: string;
  /** Oldest first, as sales draw them. */
  batches: StockBatchView[];
  /** Different landed rates among the batches in stock. */
  rates: number[];
  onChallans: number;
}

/** One document that moved the item, with the running stock after it. */
export interface ItemHistoryRow {
  date: string | null;
  kind: 'Opening stock' | 'Purchase' | 'Sale' | 'Sales return' | 'Purchase return' | 'Transfer' | 'Adjustment in' | 'Adjustment out' | 'Challan';
  number: string | null;
  /** The page of the document. */
  href: string | null;
  party: string | null;
  godown: string;
  quantityIn: number;
  quantityOut: number;
  /** Purchase: landed rate; sale: taxable value per unit; others: cost per unit. */
  rate: number;
  /** All godowns; a transfer and a challan leave it as it was. */
  balance: number;
}

// Read-only views of one item for the rate enquiry (stock enquiry) and the
// item page (client, 12 Nov 2026): the batches still in stock with their
// purchase rates, and every live document that moved it.
@Injectable()
export class ItemLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async stockDetail(itemId: string): Promise<ItemStockDetailView> {
    const [openings, batches, challans] = await Promise.all([
      this.prisma.itemOpeningStock.findMany({ where: { itemId }, select: { godownId: true, quantity: true, drawn: true, value: true, godown: { select: { name: true } } } }),
      this.prisma.stockBatch.findMany({
        where: { itemId, remaining: { gt: 0 } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          remaining: true,
          landedRate: true,
          godownId: true,
          godown: { select: { name: true } },
          ...batchSourceSelect.select,
          // The source's bill, with its vendor as well.
          billLine: { select: { bill: { select: { id: true, reference: true, vendor: { select: { displayName: true } } } } } },
        },
      }),
      this.prisma.deliveryChallanLine.aggregate({ where: { itemId, challan: { status: 'OPEN' } }, _sum: { quantity: true } }),
    ]);
    const rows: StockBatchView[] = [
      ...openings
        .filter((row) => n(row.quantity) - n(row.drawn) > 0)
        .map((row) => ({
          batchId: null,
          source: drawSource(null),
          vendor: null,
          date: null,
          godownId: row.godownId,
          godownName: row.godown.name,
          remaining: qty(n(row.quantity) - n(row.drawn)),
          landedRate: n(row.quantity) > 0 ? Math.round((n(row.value) / n(row.quantity)) * 10_000) / 10_000 : 0,
        })),
      ...batches.map((batch) => ({
        batchId: batch.id,
        source: drawSource(batch),
        vendor: batch.billLine?.bill.vendor.displayName ?? null,
        date: isoDate(batch.date),
        godownId: batch.godownId,
        godownName: batch.godown.name,
        remaining: n(batch.remaining),
        landedRate: n(batch.landedRate),
      })),
    ];
    return {
      itemId,
      batches: rows,
      rates: [...new Set(rows.map((row) => row.landedRate))].sort((a, b) => a - b),
      onChallans: n(challans._sum.quantity),
    };
  }

  async history(itemId: string): Promise<ItemHistoryRow[]> {
    const party = { select: { displayName: true } } as const;
    const godown = { select: { name: true } } as const;
    const [openings, bills, sales, credits, debits, transfers, adjustments, challans] = await Promise.all([
      this.prisma.itemOpeningStock.findMany({ where: { itemId }, select: { quantity: true, value: true, godown } }),
      this.prisma.purchaseBillLine.findMany({
        where: { itemId, bill: { status: 'OPEN' } },
        select: { quantity: true, landedRate: true, bill: { select: { id: true, reference: true, date: true, vendor: party, godown } } },
      }),
      this.prisma.invoiceLine.findMany({
        where: { itemId, invoice: { status: 'ISSUED' } },
        select: { quantity: true, freeQuantity: true, taxable: true, invoice: { select: { id: true, number: true, date: true, party, godown } } },
      }),
      this.prisma.creditNoteLine.findMany({
        where: { itemId, quantity: { gt: 0 }, creditNote: { cancelledAt: null } },
        select: { quantity: true, cost: true, creditNote: { select: { id: true, number: true, date: true, party, godown } } },
      }),
      this.prisma.debitNoteLine.findMany({
        where: { itemId, quantity: { gt: 0 }, debitNote: { cancelledAt: null } },
        select: { quantity: true, cost: true, batch: { select: { godown } }, debitNote: { select: { id: true, number: true, date: true, party } } },
      }),
      this.prisma.stockTransferLine.findMany({
        where: { itemId, transfer: { status: 'POSTED' } },
        select: { quantity: true, value: true, transfer: { select: { id: true, number: true, date: true, fromGodown: godown, toGodown: godown } } },
      }),
      this.prisma.stockAdjustmentLine.findMany({
        where: { itemId, adjustment: { status: 'POSTED' } },
        select: { quantity: true, value: true, adjustment: { select: { id: true, number: true, date: true, direction: true, godown } } },
      }),
      this.prisma.deliveryChallanLine.findMany({
        where: { itemId, challan: { status: { not: 'CANCELLED' } } },
        select: { quantity: true, rate: true, challan: { select: { id: true, number: true, date: true, status: true, party, godown } } },
      }),
    ]);
    const per = (value: number, quantity: number) => (quantity > 0 ? Math.round((value / quantity) * 100) / 100 : 0);
    type Row = Omit<ItemHistoryRow, 'balance'>;
    const rows: Row[] = [
      ...openings.map((row) => ({ date: null, kind: 'Opening stock' as const, number: null, href: null, party: null, godown: row.godown.name, quantityIn: n(row.quantity), quantityOut: 0, rate: per(n(row.value), n(row.quantity)) })),
      ...bills.map((row) => ({ date: isoDate(row.bill.date), kind: 'Purchase' as const, number: row.bill.reference, href: `/purchases/${row.bill.id}`, party: row.bill.vendor.displayName, godown: row.bill.godown?.name ?? '', quantityIn: n(row.quantity), quantityOut: 0, rate: n(row.landedRate) })),
      ...sales.map((row) => ({
        date: isoDate(row.invoice.date),
        kind: 'Sale' as const,
        number: row.invoice.number,
        href: `/invoices/${row.invoice.id}`,
        party: row.invoice.party.displayName,
        godown: row.invoice.godown.name,
        quantityIn: 0,
        quantityOut: qty(n(row.quantity) + n(row.freeQuantity)),
        rate: per(n(row.taxable), n(row.quantity)),
      })),
      ...credits.map((row) => ({ date: isoDate(row.creditNote.date), kind: 'Sales return' as const, number: row.creditNote.number, href: `/credit-notes/${row.creditNote.id}`, party: row.creditNote.party.displayName, godown: row.creditNote.godown?.name ?? '', quantityIn: n(row.quantity), quantityOut: 0, rate: per(n(row.cost), n(row.quantity)) })),
      ...debits.map((row) => ({ date: isoDate(row.debitNote.date), kind: 'Purchase return' as const, number: row.debitNote.number, href: `/debit-notes/${row.debitNote.id}`, party: row.debitNote.party.displayName, godown: row.batch?.godown.name ?? '', quantityIn: 0, quantityOut: n(row.quantity), rate: per(n(row.cost), n(row.quantity)) })),
      ...transfers.map((row) => ({
        date: isoDate(row.transfer.date),
        kind: 'Transfer' as const,
        number: row.transfer.number,
        href: `/stock-transfers/${row.transfer.id}`,
        party: null,
        godown: `${row.transfer.fromGodown.name} → ${row.transfer.toGodown.name}`,
        // Out of one godown, into another: the total stays.
        quantityIn: n(row.quantity),
        quantityOut: n(row.quantity),
        rate: per(n(row.value), n(row.quantity)),
      })),
      ...adjustments.map((row) => {
        const added = row.adjustment.direction === 'IN';
        return {
          date: isoDate(row.adjustment.date),
          kind: added ? ('Adjustment in' as const) : ('Adjustment out' as const),
          number: row.adjustment.number,
          href: `/stock-adjustments/${row.adjustment.id}`,
          party: null,
          godown: row.adjustment.godown.name,
          quantityIn: added ? n(row.quantity) : 0,
          quantityOut: added ? 0 : n(row.quantity),
          rate: per(n(row.value), n(row.quantity)),
        };
      }),
      // A challan moves no stock in the books; it shows for the record (quantity out, not counted).
      ...challans.map((row) => ({
        date: isoDate(row.challan.date),
        kind: 'Challan' as const,
        number: `${row.challan.number}${row.challan.status === 'INVOICED' ? ' (invoiced)' : ''}`,
        href: `/delivery-challans/${row.challan.id}`,
        party: row.challan.party.displayName,
        godown: row.challan.godown.name,
        quantityIn: 0,
        quantityOut: 0,
        rate: n(row.rate),
      })),
    ];
    // Opening stock first, then by date; on one day in the order business happens:
    // goods in, moves, sales, then returns of what was sold or bought.
    const rank: Record<ItemHistoryRow['kind'], number> = {
      'Opening stock': 0,
      Purchase: 1,
      'Adjustment in': 2,
      Transfer: 3,
      Challan: 4,
      Sale: 5,
      'Sales return': 6,
      'Purchase return': 7,
      'Adjustment out': 8,
    };
    rows.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || rank[a.kind] - rank[b.kind]);
    let balance = 0;
    return rows.map((row) => {
      balance = qty(balance + row.quantityIn - row.quantityOut);
      return { ...row, balance };
    });
  }
}
