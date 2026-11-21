import { describe, expect, it } from 'vitest';
import { creditNotePostings, debitNotePostings } from './note-postings.js';
import type { Posting } from './statements.js';
import { systemLedgers } from './system-ledgers.js';
import { imbalance } from './voucher-lines.js';

const ledgers = systemLedgers([]);
const customer = { ledger: 'Dorji Traders', group: 'Sundry Debtors' };
const vendor = { ledger: 'Tata Steel Ltd', group: 'Sundry Creditors' };
const byLedger = (lines: Posting[]) => Object.fromEntries(lines.map((line) => [line.ledger, Math.round((line.debit - line.credit) * 100) / 100]));

describe('credit note postings', () => {
  it('takes back sales and output GST from the customer', () => {
    const lines = creditNotePostings({ gstAdjusted: true, regime: 'INTRA_STATE', taxable: 665, cgst: 59.85, sgst: 59.85, igst: 0, roundOff: 0.3, total: 785 }, customer, ledgers);
    expect(byLedger(lines)).toEqual({
      'Dorji Traders': -785,
      'Sales Returns': 665,
      'Output CGST': 59.85,
      'Output SGST': 59.85,
      // 784.70 rounded up: the invoice credits Round Off, its note debits it.
      'Round Off': 0.3,
    });
    expect(imbalance(lines)).toBe(0);
  });

  it('on an export with IGST paid, turns round the refund receivable as well', () => {
    const lines = creditNotePostings({ gstAdjusted: true, regime: 'EXPORT_IGST', taxable: 1000, cgst: 0, sgst: 0, igst: 180, roundOff: 0, total: 1180 }, customer, ledgers);
    expect(byLedger(lines)).toMatchObject({ 'Dorji Traders': -1000, 'Sales Returns': 1000, 'Output IGST': 180 });
    expect(byLedger(lines)).not.toHaveProperty('Export Sales - IGST');
    expect(imbalance(lines)).toBe(0);
  });
});

describe('debit note postings', () => {
  it('gives back the purchase and the input credit claimed', () => {
    const lines = debitNotePostings(
      { gstAdjusted: true, regime: 'INTRA_STATE', cgst: 45, sgst: 45, igst: 0, tax: 90, itcReversed: 90, roundOff: 0, total: 590, lines: [{ taxable: 500, tax: 90, itcEligible: true }] },
      vendor,
      ledgers,
    );
    expect(byLedger(lines)).toEqual({ 'Tata Steel Ltd': 590, 'Purchase - GST Local': -500, 'Input CGST': -45, 'Input SGST': -45 });
    expect(imbalance(lines)).toBe(0);
  });

  it('puts GST that was never claimed back through the no-credit purchase ledger', () => {
    const lines = debitNotePostings(
      { gstAdjusted: true, regime: 'INTRA_STATE', cgst: 45, sgst: 45, igst: 0, tax: 90, itcReversed: 0, roundOff: 0, total: 590, lines: [{ taxable: 500, tax: 90, itcEligible: false }] },
      vendor,
      ledgers,
    );
    expect(byLedger(lines)).toEqual({ 'Tata Steel Ltd': 590, 'Purchase - No Input Credit': -590 });
    expect(imbalance(lines)).toBe(0);
  });
});

describe('notes without GST', () => {
  it('books a discount not agreed at the sale as Discount Allowed, leaving sales and GST alone', () => {
    const lines = creditNotePostings({ gstAdjusted: false, regime: 'INTRA_STATE', taxable: 499.6, cgst: 0, sgst: 0, igst: 0, roundOff: 0.4, total: 500 }, customer, ledgers);
    expect(byLedger(lines)).toEqual({ 'Dorji Traders': -500, 'Discount Allowed': 499.6, 'Round Off': 0.4 });
    expect(imbalance(lines)).toBe(0);
  });

  it('books a vendor’s discount as Discount Received, giving back no input credit', () => {
    const lines = debitNotePostings(
      { gstAdjusted: false, regime: 'INTRA_STATE', cgst: 0, sgst: 0, igst: 0, tax: 0, itcReversed: 0, roundOff: 0, total: 300, lines: [{ taxable: 300, tax: 0, itcEligible: true }] },
      vendor,
      ledgers,
    );
    expect(byLedger(lines)).toEqual({ 'Tata Steel Ltd': 300, 'Discount Received': -300 });
    expect(imbalance(lines)).toBe(0);
  });
});
