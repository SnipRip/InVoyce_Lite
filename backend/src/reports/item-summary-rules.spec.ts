import { describe, expect, it } from 'vitest';
import { buildLots, daysOfStock, marginOn, monthRows, partyTotals, shareLineSales, type LotSource } from './item-summary-rules.js';

const lot = (key: string, date: string | null, received: number, landedRate: number): LotSource => ({
  key,
  kind: date ? 'bill' : 'opening',
  sourceId: null,
  label: key,
  party: null,
  date,
  godown: 'Main',
  received,
  landedRate,
});

describe('shareLineSales', () => {
  it('gives free units no sale value and splits a line over its draws by units charged', () => {
    // 10 charged + 2 free, drawn 8 from one lot and 4 from the next.
    const slices = shareLineSales([
      { lineId: 'L', lineQuantity: 10, lineTaxable: 1000, quantity: 8 },
      { lineId: 'L', lineQuantity: 10, lineTaxable: 1000, quantity: 4 },
    ]);
    expect(slices.map((slice) => slice.sales)).toEqual([800, 200]);
  });
});

describe('buildLots', () => {
  it('follows each lot through sales, returns and write-offs', () => {
    const lots = buildLots(
      [lot('B2', '2026-10-05', 50, 60), lot('open', null, 20, 50), lot('B1', '2026-10-01', 100, 55)],
      new Map([
        ['open', 0],
        ['B1', 30],
        ['B2', 50],
      ]),
      [
        { lotKey: 'open', date: '2026-10-02', invoiceId: 'i1', invoice: 'INV/1', customer: 'A', quantity: 20, sales: 1400, cost: 1000 },
        { lotKey: 'B1', date: '2026-10-03', invoiceId: 'i2', invoice: 'INV/2', customer: 'B', quantity: 60, sales: 4200, cost: 3300 },
        { lotKey: 'B1', date: '2026-10-04', invoiceId: 'i3', invoice: 'INV/3', customer: 'A', quantity: 5, sales: 0, cost: 275 },
      ],
      [
        { lotKey: 'B1', kind: 'returned', quantity: 3, value: 165 },
        { lotKey: 'B1', kind: 'writtenOff', quantity: 2, value: 110 },
      ],
    );
    expect(lots.map((row) => row.key)).toEqual(['open', 'B1', 'B2']);
    expect(lots[0]).toMatchObject({ sold: 20, remaining: 0, profit: 400, marginPct: 28.6, status: 'Sold out', saleRate: 70 });
    expect(lots[1]).toMatchObject({ sold: 65, returned: 3, writtenOff: 2, remaining: 30, sales: 4200, costOfSales: 3575, profit: 625, status: 'Partly sold', saleRate: 70 });
    expect(lots[1].saleSlices.map((slice) => slice.invoice)).toEqual(['INV/3', 'INV/2']);
    expect(lots[2]).toMatchObject({ sold: 0, remaining: 50, profit: 0, marginPct: null, saleRate: null, status: 'In stock' });
  });

  it('calls a lot that left without a sale gone', () => {
    const [row] = buildLots([lot('B', '2026-10-01', 5, 10)], new Map(), [], [{ lotKey: 'B', kind: 'writtenOff', quantity: 5, value: 50 }]);
    expect(row.status).toBe('Gone');
  });
});

describe('monthRows', () => {
  it('adds purchases and sales by month, oldest first', () => {
    const rows = monthRows(
      [
        { date: '2026-10-01', quantity: 100, value: 5500 },
        { date: '2026-09-15', quantity: 10, value: 500 },
      ],
      [
        { date: '2026-10-03', quantity: 60, sales: 4200, cost: 3300 },
        { date: '2026-10-20', quantity: 10, sales: 800, cost: 550 },
      ],
    );
    expect(rows).toEqual([
      { month: '2026-09', purchased: 10, purchaseValue: 500, sold: 0, sales: 0, costOfSales: 0, profit: 0, marginPct: null },
      { month: '2026-10', purchased: 100, purchaseValue: 5500, sold: 70, sales: 5000, costOfSales: 3850, profit: 1150, marginPct: 23 },
    ]);
  });
});

describe('partyTotals', () => {
  it('counts documents once and keeps the latest rate', () => {
    const rows = partyTotals([
      { party: 'A', document: 'i1', date: '2026-10-01', quantity: 5, value: 500, profit: 100, rate: 100 },
      { party: 'A', document: 'i1', date: '2026-10-01', quantity: 5, value: 500, profit: 50, rate: 100 },
      { party: 'A', document: 'i2', date: '2026-10-09', quantity: 2, value: 240, profit: 40, rate: 120 },
      { party: 'B', document: 'i3', date: '2026-10-05', quantity: 1, value: 90, rate: null },
    ]);
    expect(rows[0]).toEqual({ party: 'A', documents: 2, quantity: 12, value: 1240, profit: 190, averageRate: 103.33, lastDate: '2026-10-09', lastRate: 120 });
    expect(rows[1]).toMatchObject({ party: 'B', lastRate: null });
  });
});

describe('small figures', () => {
  it('margin and days of stock', () => {
    expect(marginOn(0, 10)).toBeNull();
    expect(marginOn(200, 150)).toBe(25);
    expect(daysOfStock(90, 0, 90)).toBeNull();
    expect(daysOfStock(90, 45, 90)).toBe(180);
  });
});
