import { ledgerStatement, movementOn, particularsOf, type BookVoucher } from './book-vouchers.js';

const voucher = (date: string, type: string, number: string, lines: [string, number, number][], source: BookVoucher['source'] = 'journal'): BookVoucher => ({
  date,
  type,
  number,
  source,
  sourceId: number,
  narration: null,
  lines: lines.map(([ledger, debit, credit]) => ({ ledger, group: 'Suspense A/c', debit, credit })),
});

// Cash opens with 10,000. A receipt of 5,000 before the period, a payment of
// 2,000 and a sale on credit (not touching cash) in it.
const vouchers: BookVoucher[] = [
  voucher('2026-04-05', 'Receipt', 'RCT-1', [['Cash', 5000, 0], ['Shiv Traders', 0, 5000]], 'settlement'),
  voucher('2026-05-01', 'Payment', 'PMT-1', [['Rent', 2000, 0], ['Cash', 0, 2000]], 'expense'),
  voucher('2026-05-02', 'Sales', 'INV-1', [['Shiv Traders', 1180, 0], ['Sales - GST Local', 0, 1000], ['Output CGST', 0, 90], ['Output SGST', 0, 90]], 'invoice'),
  voucher('2026-06-01', 'Receipt', 'RCT-2', [['Cash', 1000, 0], ['Shiv Traders', 0, 1000]], 'settlement'),
];

describe('ledgerStatement', () => {
  it('opens with what moved before the first day and runs a balance', () => {
    const cash = ledgerStatement({ name: 'Cash', group: 'Cash-in-Hand', opening: 10000 }, vouchers, '2026-05-01', '2026-05-31');
    expect(cash.opening).toBe(15000);
    expect(cash.rows).toHaveLength(1);
    expect(cash.rows[0]).toMatchObject({ number: 'PMT-1', particulars: 'Rent', debit: 0, credit: 2000, balance: 13000 });
    expect(cash.closing).toBe(13000);
  });

  it('leaves out vouchers after the last day', () => {
    const cash = ledgerStatement({ name: 'Cash', group: null, opening: 0 }, vouchers, '2026-04-01', '2026-05-31');
    expect(cash.rows.map((row) => row.number)).toEqual(['RCT-1', 'PMT-1']);
    expect(cash.totalDebit).toBe(5000);
    expect(cash.totalCredit).toBe(2000);
    expect(cash.closing).toBe(3000);
  });

  it('names the largest ledger on the other side, and says when there are more', () => {
    const party = ledgerStatement({ name: 'shiv traders', group: 'Sundry Debtors', opening: 0 }, vouchers, '2026-04-01', '2027-03-31');
    expect(party.rows.map((row) => [row.number, row.particulars, row.balance])).toEqual([
      ['RCT-1', 'Cash', -5000],
      ['INV-1', 'Sales - GST Local and others', -3820],
      ['RCT-2', 'Cash', -4820],
    ]);
  });

  it('has opening equal to closing when nothing moved', () => {
    const rent = ledgerStatement({ name: 'Rent', group: null, opening: 0 }, vouchers, '2026-06-01', '2026-06-30');
    expect(rent.opening).toBe(2000);
    expect(rent.rows).toEqual([]);
    expect(rent.closing).toBe(2000);
  });
});

describe('particularsOf', () => {
  it('reads the credit side for a debited ledger', () => {
    expect(particularsOf(vouchers[1], 'Rent', true)).toBe('Cash');
    expect(particularsOf(vouchers[1], 'Cash', false)).toBe('Rent');
  });
});

describe('movementOn', () => {
  it('sums the chosen ledgers in the period, skipping sources already counted', () => {
    const rent = (name: string) => name === 'Rent';
    expect(movementOn(vouchers, rent, '2026-04-01', '2027-03-31', new Set())).toBe(2000);
    expect(movementOn(vouchers, rent, '2026-04-01', '2027-03-31', new Set(['expense']))).toBe(0);
    expect(movementOn(vouchers, rent, '2026-06-01', '2027-03-31', new Set())).toBe(0);
  });
});
