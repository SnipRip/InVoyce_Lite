import { describe, expect, it } from 'vitest';
import { cleanDetails, cleanNumber, documentDateProblem, documentKindProblem, nameInText, needsEinvoice } from './dispatch-document-rules.js';

const IRN = 'A'.repeat(32) + '0123456789abcdef0123456789abcdef';

describe('documentKindProblem', () => {
  it('takes transport papers on any invoice', () => {
    expect(documentKindProblem('EWAY_BILL', 'CONSUMER')).toBeNull();
    expect(documentKindProblem('LORRY_CHALLAN', 'UNREGISTERED')).toBeNull();
  });
  it('gives an IRN to B2B only', () => {
    expect(needsEinvoice('REGISTERED')).toBe(true);
    expect(needsEinvoice('COMPOSITION')).toBe(true);
    expect(documentKindProblem('E_INVOICE', 'REGISTERED')).toBeNull();
    expect(documentKindProblem('E_INVOICE', 'CONSUMER')).toMatch(/no IRN/);
    expect(documentKindProblem('E_INVOICE', 'UNREGISTERED')).toMatch(/no IRN/);
  });
});

describe('cleanNumber', () => {
  it('stores the IRN in lower case and checks fixed formats', () => {
    expect(cleanNumber('E_INVOICE', ` ${IRN} `)).toEqual({ number: IRN.toLowerCase() });
    expect(cleanNumber('E_INVOICE', 'abc')).toEqual({ problem: expect.stringMatching(/64/) as string });
    expect(cleanNumber('EWAY_BILL', '123456789012')).toEqual({ number: '123456789012' });
    expect(cleanNumber('EWAY_BILL', '12345')).toEqual({ problem: expect.stringMatching(/12 digits/) as string });
    expect(cleanNumber('LORRY_CHALLAN', '  ')).toEqual({ problem: 'Enter the document number' });
    expect(cleanNumber('LORRY_CHALLAN', 'LR/77')).toEqual({ number: 'LR/77' });
  });
});

describe('cleanDetails', () => {
  it('turns amounts into numbers, upper-cases codes and drops blanks', () => {
    expect(cleanDetails('LORRY_CHALLAN', { transporter: ' Royal Transport ', vehicle: 'wb73e1234', freight: '8500.50' })).toEqual({
      details: { transporter: 'Royal Transport', vehicle: 'WB73E1234', freight: 8500.5 },
    });
    expect(cleanDetails('LORRY_CHALLAN', { transporter: '', freight: 1200 })).toEqual({ details: { freight: 1200 } });
  });
  it('refuses bad values and fields the kind does not have', () => {
    expect(cleanDetails('LORRY_CHALLAN', { vehicle: 'WB 73 E 1234' })).toEqual({ problem: expect.stringMatching(/WB73E1234/) as string });
    expect(cleanDetails('E_INVOICE', { ackNo: '12' })).toEqual({ problem: expect.stringMatching(/15 digits/) as string });
    expect(cleanDetails('EWAY_BILL', { amount: '5' })).toEqual({ problem: expect.stringMatching(/no field "amount"/) as string });
    expect(cleanDetails('LORRY_CHALLAN', { freight: '-5' })).toEqual({ problem: expect.stringMatching(/freight/i) as string });
    expect(cleanDetails('LORRY_CHALLAN', { transporter: { name: 'x' } })).toEqual({ problem: expect.stringMatching(/transporter/i) as string });
  });
});

describe('documentDateProblem', () => {
  it('dates a paper between its invoice and today', () => {
    expect(documentDateProblem({ date: '2026-11-06', details: {} }, '2026-11-06', '2026-11-07')).toBeNull();
    expect(documentDateProblem({ date: '2026-11-05', details: {} }, '2026-11-06', '2026-11-07')).toMatch(/before the invoice/);
    expect(documentDateProblem({ date: '2026-11-08', details: {} }, '2026-11-06', '2026-11-07')).toMatch(/after today/);
  });
  it('keeps an e-way bill valid until on or after its date', () => {
    expect(documentDateProblem({ date: '2026-11-06', details: { validUntil: '2026-11-08' } }, '2026-11-06', '2026-11-07')).toBeNull();
    expect(documentDateProblem({ date: '2026-11-06', details: { validUntil: '2026-11-05' } }, '2026-11-06', '2026-11-07')).toMatch(/Valid until/);
  });
});

describe('nameInText', () => {
  it('lower-cases a name', () => {
    expect(nameInText('EWAY_BILL')).toBe('e-way bill');
    expect(nameInText('E_INVOICE')).toBe('e-invoice (IRN)');
  });
});
