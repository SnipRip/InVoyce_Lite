import { describe, expect, it } from 'vitest';
import { cashByParty, journalProblem, journalVoucherType, partySideOf, settlesOutstanding, totalsOf, type JournalLineInput } from './journal-rules.js';

const line = (id: string, debit: number, credit: number, isMoney = false, kind: JournalLineInput['kind'] = 'ledger'): JournalLineInput => ({ kind, id, debit, credit, isMoney });

describe('journalProblem', () => {
  it('accepts a balanced voucher', () => {
    // Depreciation: Dr Depreciation 12,000 / Cr Truck 12,000.
    expect(journalProblem([line('dep', 12000, 0, false, 'head'), line('truck', 0, 12000)])).toBeNull();
    // Split over three ledgers, to the paisa.
    expect(journalProblem([line('a', 100.1, 0), line('b', 50.05, 0), line('c', 0, 150.15)])).toBeNull();
  });

  it('refuses a voucher that does not balance, and says by how much', () => {
    expect(journalProblem([line('a', 1000, 0), line('b', 0, 900)])).toMatch(/difference is ₹100\.00/);
  });

  it('needs two lines, one on each side', () => {
    expect(journalProblem([line('a', 100, 0)])).toMatch(/at least two lines/);
    expect(journalProblem([line('a', 100, 0), line('b', 100, 0)])).toMatch(/Debit one ledger and credit another/);
  });

  it('wants one side per line, nothing negative, each ledger once', () => {
    expect(journalProblem([line('a', 100, 100), line('b', 0, 0)])).toMatch(/Line 1: .*not both/);
    expect(journalProblem([line('a', 100, 0), line('b', 0, 0)])).toMatch(/Line 2: .*not neither/);
    expect(journalProblem([line('a', -5, 0), line('b', 0, 5)])).toMatch(/below zero/);
    expect(journalProblem([line('a', 100, 0), line('a', 0, 100)])).toMatch(/one line only/);
    // The same id under another kind is another ledger.
    expect(journalProblem([line('a', 100, 0, false, 'ledger'), line('a', 0, 100, false, 'head')])).toBeNull();
  });
});

describe('journalVoucherType', () => {
  it('names the voucher from where bank and cash sit', () => {
    expect(journalVoucherType([line('dep', 100, 0), line('truck', 0, 100)])).toBe('Journal');
    // Cash put in the bank.
    expect(journalVoucherType([line('bank', 5000, 0, true), line('cash', 0, 5000, true)])).toBe('Contra');
    // Rent paid by cash; interest received in the bank.
    expect(journalVoucherType([line('rent', 2000, 0), line('cash', 0, 2000, true)])).toBe('Payment');
    expect(journalVoucherType([line('bank', 300, 0, true), line('interest', 0, 300)])).toBe('Receipt');
  });
});

describe('totalsOf', () => {
  it('adds each side to the paisa', () => {
    expect(totalsOf([line('a', 0.1, 0), line('b', 0.2, 0), line('c', 0, 0.3)])).toEqual({ debit: 0.3, credit: 0.3 });
  });
});

describe('party lines', () => {
  const both = { displayName: 'Sharma Hardware', isCustomer: true, isVendor: true, isArchived: false };

  it('settles on the side that reduces what is outstanding, else adds a charge', () => {
    // Bad debt written off: Cr customer settles what they owe.
    expect(settlesOutstanding('RECEIVABLE', { debit: 0, credit: 500 })).toBe(true);
    // Interest charged: Dr customer adds to what they owe.
    expect(settlesOutstanding('RECEIVABLE', { debit: 200, credit: 0 })).toBe(false);
    // Discount received: Dr vendor settles what we owe.
    expect(settlesOutstanding('PAYABLE', { debit: 300, credit: 0 })).toBe(true);
    expect(settlesOutstanding('PAYABLE', { debit: 0, credit: 300 })).toBe(false);
  });

  it('takes the party’s only role, and asks when it is both', () => {
    expect(partySideOf({ ...both, isVendor: false })).toBe('RECEIVABLE');
    expect(partySideOf({ ...both, isCustomer: false })).toBe('PAYABLE');
    expect(partySideOf(both)).toMatch(/both customer and vendor/);
    expect(partySideOf(both, 'PAYABLE')).toBe('PAYABLE');
    expect(partySideOf({ ...both, isVendor: false }, 'PAYABLE')).toMatch(/not a vendor/);
    expect(partySideOf({ ...both, isArchived: true })).toMatch(/archived/);
  });

  it('books a party line as a journal: no bank or cash, no Contra', () => {
    expect(journalVoucherType([line('bad-debts', 500, 0, false, 'head'), line('sharma', 0, 500, false, 'party')])).toBe('Journal');
    expect(journalVoucherType([line('bank', 500, 0, true, 'account'), line('sharma', 0, 500, false, 'party')])).toBe('Receipt');
  });
});

describe('cashByParty', () => {
  const cash = (kind: 'party' | 'account' | 'head' | 'ledger', id: string, debit: number, credit: number, isCash = false) => ({ kind, id, debit, credit, isCash });

  it('counts cash a customer pays in on a receipt journal', () => {
    // Dr Cash 2,50,000 / Cr customer 2,50,000.
    expect(cashByParty([cash('account', 'cash', 250000, 0, true), cash('party', 'c1', 0, 250000)]).get('c1')).toEqual({ received: 250000, paid: 0 });
  });

  it('counts cash paid to a vendor, up to the cash that went out', () => {
    // Dr vendor 15,000 / Cr Cash 12,000 / Cr Bank 3,000.
    const flows = cashByParty([cash('party', 'v1', 15000, 0), cash('account', 'cash', 0, 12000, true), cash('account', 'bank', 0, 3000)]);
    expect(flows.get('v1')).toEqual({ received: 0, paid: 12000 });
  });

  it('ignores bank money, contras and journals without cash', () => {
    expect(cashByParty([cash('account', 'bank', 300000, 0), cash('party', 'c1', 0, 300000)]).size).toBe(0);
    expect(cashByParty([cash('account', 'bank', 50000, 0), cash('account', 'cash', 0, 50000, true)]).size).toBe(0);
    expect(cashByParty([cash('head', 'bad-debts', 5000, 0), cash('party', 'c1', 0, 5000)]).size).toBe(0);
  });

  it('never counts a party line on the same side as the cash', () => {
    // Cash in, but the vendor is debited (a charge on them), the sales ledger credited.
    const flows = cashByParty([cash('account', 'cash', 20000, 0, true), cash('party', 'v1', 1000, 0), cash('ledger', 'sales', 0, 21000)]);
    expect(flows.size).toBe(0);
  });
});
