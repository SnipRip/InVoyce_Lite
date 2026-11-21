import { describe, expect, it } from 'vitest';
import { buildProfitReport, profitOf, shareByValue, type ProfitExpense, type ProfitInvoice } from './profit-rules.js';

const line = (itemId: string, taxable: number, costOfGoods: number) => ({ itemId, itemName: `Item ${itemId}`, sku: itemId.toUpperCase(), taxable, costOfGoods });

const saleA: ProfitInvoice = {
  id: 'a',
  number: 'INV/2627/0002',
  date: '2026-11-02',
  partyId: 'gupta',
  partyName: 'Gupta Builders',
  taxable: 60_000,
  cost: 45_000,
  lines: [line('tmt', 40_000, 30_000), line('pipe', 20_000, 15_000)],
};
const saleB: ProfitInvoice = { ...saleA, id: 'b', number: 'INV/2627/0003', taxable: 40_000, cost: 32_000, lines: [line('tmt', 40_000, 32_000)] };
const local: ProfitInvoice = {
  id: 'c',
  number: 'INV/2627/0001',
  date: '2026-11-03',
  partyId: 'sharma',
  partyName: 'Sharma Hardware',
  taxable: 10_000,
  cost: 8_000,
  lines: [line('pipe', 10_000, 8_000)],
};
const expense = (id: string, cost: number, allocation: ProfitExpense['allocation'], target: Partial<ProfitExpense> = {}): ProfitExpense => ({
  id,
  date: '2026-11-04',
  headName: allocation === 'OVERHEAD' ? 'Rent' : 'Freight',
  cost,
  allocation,
  invoiceId: null,
  ...target,
});

describe('shareByValue', () => {
  it('splits by value and the last takes the rounding', () => {
    expect(shareByValue(100, [1, 1, 1])).toEqual([33.33, 33.33, 33.34]);
    expect(shareByValue(6_000, [60_000, 40_000])).toEqual([3_600, 2_400]);
  });
  it('gives nothing when there is no value to share on', () => {
    expect(shareByValue(500, [0, 0])).toEqual([0, 0]);
  });
});

describe('buildProfitReport', () => {
  const onSales = [
    expense('freight-a', 3_600, 'INVOICE', { invoiceId: 'a' }),
    expense('freight-b', 2_400, 'INVOICE', { invoiceId: 'b' }),
    expense('loading', 1_200, 'INVOICE', { invoiceId: 'c' }),
  ];
  const overheads = [expense('rent', 18_000, 'OVERHEAD'), expense('power', 2_000, 'OVERHEAD', { headName: 'Electricity' })];
  const report = buildProfitReport([saleA, saleB, local], onSales, overheads);

  it('takes each invoice’s own expenses off its profit', () => {
    expect(report.byInvoice.map((row) => [row.label, row.expenses, row.profit])).toEqual([
      ['INV/2627/0002', 3_600, 11_400],
      ['INV/2627/0003', 2_400, 5_600],
      ['INV/2627/0001', 1_200, 800],
    ]);
    expect(report.byInvoice[0]).toMatchObject(profitOf([saleA], [3_600]));
  });

  it('adds up to the same total in every view', () => {
    for (const rows of [report.byInvoice, report.byCustomer, report.byItem]) {
      expect(rows.reduce((sum, row) => sum + row.profit, 0)).toBeCloseTo(report.total.profit, 2);
      expect(rows.reduce((sum, row) => sum + row.expenses, 0)).toBeCloseTo(report.total.expenses, 2);
    }
    expect(report.total).toMatchObject({ sales: 110_000, cost: 85_000, expenses: 7_200, profit: 17_800 });
  });

  it('spreads an invoice’s expenses over its lines by value', () => {
    const tmt = report.byItem.find((row) => row.key === 'tmt');
    // INV 0002: 3,600 × 40/60 = 2,400; INV 0003: 2,400.
    expect(tmt).toMatchObject({ sales: 80_000, cost: 62_000, expenses: 4_800, profit: 13_200 });
  });

  it('takes a return of an earlier invoice off this period as a row of its own', () => {
    const earlierReturn: ProfitInvoice = {
      id: 'cn1',
      number: 'CN/2627/0001',
      date: '2026-11-05',
      partyId: 'sharma',
      partyName: 'Sharma Hardware',
      taxable: -2_000,
      cost: -1_600,
      lines: [line('pipe', -2_000, -1_600)],
      creditNoteOf: 'INV/2526/0099',
    };
    const report = buildProfitReport([local, earlierReturn], [], []);
    const row = report.byInvoice.find((candidate) => candidate.key === 'cn1')!;
    expect(row.kind).toBe('creditNote');
    expect(row.detail).toContain('INV/2526/0099');
    expect(report.total.sales).toBe(8_000);
    expect(report.total.profit).toBe(1_600);
    expect(report.byItem.find((candidate) => candidate.key === 'pipe')!.sales).toBe(8_000);
  });

  it('takes overheads off for net profit', () => {
    expect(report.overheads.total).toBe(20_000);
    expect(report.overheads.byHead).toEqual([
      { head: 'Rent', amount: 18_000, count: 1 },
      { head: 'Electricity', amount: 2_000, count: 1 },
    ]);
    expect(report.netProfit).toBe(17_800 - 20_000);
  });

  it('counts nothing for an empty period', () => {
    const empty = buildProfitReport([], [], []);
    expect(empty.total).toEqual({ sales: 0, cost: 0, expenses: 0, profit: 0, marginPct: 0 });
    expect(empty.byInvoice).toEqual([]);
  });
});
