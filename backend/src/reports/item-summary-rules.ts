// Pure pieces of the item summary report (client, 13 Nov 2026): one item's
// lots (each purchase, opening stock, stock added or goods returned by a
// customer) followed through every sale, return to vendor and write-off, so
// each lot shows what is left of it and the profit it has made so far.
// A transfer only moves part of a lot to another godown: the moved batch
// stays part of the lot it came from.
import { paise } from './report-rules.js';

export type LotKind = 'bill' | 'opening' | 'adjustment' | 'creditNote';

/** Where a lot came in, before anything left it. */
export interface LotSource {
  key: string;
  kind: LotKind;
  /** The bill, adjustment or credit note; null for opening stock. */
  sourceId: string | null;
  label: string;
  /** Vendor on a bill, customer on a credit note. */
  party: string | null;
  /** Null for opening stock. */
  date: string | null;
  godown: string;
  received: number;
  /** Landed rate per base unit (restated when the bill's charges change). */
  landedRate: number;
}

/** One slice of a lot sold on an invoice. */
export interface LotSale {
  lotKey: string;
  date: string;
  invoiceId: string;
  invoice: string;
  customer: string;
  quantity: number;
  /** The slice's share of the line's taxable value; free units carry none. */
  sales: number;
  cost: number;
}

/** Stock that left a lot other than by a sale. */
export interface LotOut {
  lotKey: string;
  kind: 'returned' | 'writtenOff';
  quantity: number;
  value: number;
}

export type LotStatus = 'In stock' | 'Partly sold' | 'Sold out' | 'Gone';

export interface LotView extends LotSource {
  sold: number;
  returned: number;
  writtenOff: number;
  remaining: number;
  sales: number;
  costOfSales: number;
  profit: number;
  marginPct: number | null;
  /** Average taxable value per unit sold from this lot. */
  saleRate: number | null;
  status: LotStatus;
  /** Newest first. */
  saleSlices: Omit<LotSale, 'lotKey'>[];
}

const qty = (value: number) => Math.round(value * 1000) / 1000;

/** Margin on sales, one decimal; none before a sale. */
export const marginOn = (sales: number, cost: number) => (sales > 0 ? Math.round(((sales - cost) / sales) * 1000) / 10 : null);

/**
 * A line's taxable value shared over its draws by the units charged, in the
 * order given: free units are drawn last and carry no sale value.
 */
export function shareLineSales<T extends { lineId: string; lineQuantity: number; lineTaxable: number; quantity: number }>(slices: T[]): (T & { sales: number })[] {
  const charged = new Map<string, number>();
  return slices.map((slice) => {
    const before = charged.get(slice.lineId) ?? 0;
    const units = Math.min(slice.quantity, Math.max(slice.lineQuantity - before, 0));
    charged.set(slice.lineId, before + units);
    const rate = slice.lineQuantity > 0 ? slice.lineTaxable / slice.lineQuantity : 0;
    return { ...slice, sales: paise(units * rate) };
  });
}

function statusOf(lot: { received: number; sold: number; remaining: number }): LotStatus {
  if (lot.remaining <= 0) return lot.sold > 0 ? 'Sold out' : 'Gone';
  return lot.sold > 0 ? 'Partly sold' : 'In stock';
}

/** Every lot with what left it and what is left; oldest first, opening stock first. */
export function buildLots(sources: LotSource[], remainingByLot: Map<string, number>, sales: LotSale[], outs: LotOut[]): LotView[] {
  return sources
    .map((source) => {
      const mine = sales.filter((sale) => sale.lotKey === source.key);
      const left = outs.filter((out) => out.lotKey === source.key);
      const sold = qty(mine.reduce((sum, sale) => sum + sale.quantity, 0));
      const lotSales = paise(mine.reduce((sum, sale) => sum + sale.sales, 0));
      const costOfSales = paise(mine.reduce((sum, sale) => sum + sale.cost, 0));
      const remaining = qty(remainingByLot.get(source.key) ?? 0);
      const charged = mine.filter((sale) => sale.sales > 0).reduce((sum, sale) => sum + sale.quantity, 0);
      return {
        ...source,
        sold,
        returned: qty(left.filter((out) => out.kind === 'returned').reduce((sum, out) => sum + out.quantity, 0)),
        writtenOff: qty(left.filter((out) => out.kind === 'writtenOff').reduce((sum, out) => sum + out.quantity, 0)),
        remaining,
        sales: lotSales,
        costOfSales,
        profit: paise(lotSales - costOfSales),
        marginPct: marginOn(lotSales, costOfSales),
        saleRate: charged > 0 ? paise(lotSales / charged) : null,
        status: statusOf({ received: source.received, sold, remaining }),
        saleSlices: mine
          .map(({ lotKey: _lotKey, ...slice }) => slice)
          .sort((a, b) => b.date.localeCompare(a.date) || b.invoice.localeCompare(a.invoice)),
      };
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.label.localeCompare(b.label));
}

export interface MonthRow {
  /** YYYY-MM. */
  month: string;
  purchased: number;
  purchaseValue: number;
  sold: number;
  sales: number;
  costOfSales: number;
  profit: number;
  marginPct: number | null;
}

/** Month by month, oldest first: goods bought (landed cost) and sold (value and cost). */
export function monthRows(purchases: { date: string; quantity: number; value: number }[], sales: { date: string; quantity: number; sales: number; cost: number }[]): MonthRow[] {
  const months = new Map<string, MonthRow>();
  const row = (date: string) => {
    const month = date.slice(0, 7);
    let entry = months.get(month);
    if (!entry) {
      entry = { month, purchased: 0, purchaseValue: 0, sold: 0, sales: 0, costOfSales: 0, profit: 0, marginPct: null };
      months.set(month, entry);
    }
    return entry;
  };
  for (const purchase of purchases) {
    const entry = row(purchase.date);
    entry.purchased = qty(entry.purchased + purchase.quantity);
    entry.purchaseValue = paise(entry.purchaseValue + purchase.value);
  }
  for (const sale of sales) {
    const entry = row(sale.date);
    entry.sold = qty(entry.sold + sale.quantity);
    entry.sales = paise(entry.sales + sale.sales);
    entry.costOfSales = paise(entry.costOfSales + sale.cost);
  }
  return [...months.values()]
    .map((entry) => ({ ...entry, profit: paise(entry.sales - entry.costOfSales), marginPct: marginOn(entry.sales, entry.costOfSales) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface PartyTotal {
  party: string;
  documents: number;
  quantity: number;
  value: number;
  /** Customers: profit on what they bought; vendors: 0. */
  profit: number;
  /** Value per unit: average sale rate, or average landed rate. */
  averageRate: number | null;
  lastDate: string;
  lastRate: number | null;
}

/** Totals per party, largest value first. */
export function partyTotals(rows: { party: string; document: string; date: string; quantity: number; value: number; profit?: number; rate: number | null }[]): PartyTotal[] {
  const parties = new Map<string, PartyTotal & { seen: Set<string> }>();
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const entry = parties.get(row.party) ?? { party: row.party, documents: 0, quantity: 0, value: 0, profit: 0, averageRate: null, lastDate: row.date, lastRate: null, seen: new Set<string>() };
    entry.seen.add(row.document);
    entry.quantity = qty(entry.quantity + row.quantity);
    entry.value = paise(entry.value + row.value);
    entry.profit = paise(entry.profit + (row.profit ?? 0));
    entry.lastDate = row.date;
    if (row.rate !== null) entry.lastRate = row.rate;
    parties.set(row.party, entry);
  }
  return [...parties.values()]
    .map(({ seen, ...entry }) => ({ ...entry, documents: seen.size, averageRate: entry.quantity > 0 ? paise(entry.value / entry.quantity) : null }))
    .sort((a, b) => b.value - a.value);
}

/** Days the stock lasts at the recent daily sale; null when nothing sold lately. */
export function daysOfStock(onHand: number, soldInWindow: number, windowDays: number): number | null {
  if (soldInWindow <= 0 || windowDays <= 0) return null;
  return Math.round(onHand / (soldInWindow / windowDays));
}
