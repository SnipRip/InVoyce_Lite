import { invoiceRegime, rateSourceOf, saleRegime, schemeSourceOf } from './sale-rules.js';

const WB = '19';
const US = { stateCode: WB, registration: 'REGULAR' as const };

describe('saleRegime', () => {
  it('follows the buyer', () => {
    expect(saleRegime(US, { treatment: 'REGISTERED', placeOfSupply: WB })).toEqual({ regime: 'INTRA_STATE', split: 'INTRA', problem: null });
    expect(saleRegime(US, { treatment: 'REGISTERED', placeOfSupply: '18' })).toEqual({ regime: 'INTER_STATE', split: 'INTER', problem: null });
    expect(saleRegime(US, { treatment: 'UNREGISTERED', placeOfSupply: null }).regime).toBe('INTRA_STATE');
  });
});

describe('rateSourceOf', () => {
  const offered = { special: 59.75, sheet: 61.25, lastQuoted: 60, lastSold: null };
  it('names the offered rate the line took, in the order shown', () => {
    expect(rateSourceOf(59.75, offered)).toBe('SPECIAL');
    expect(rateSourceOf(61.25, offered)).toBe('SHEET');
    expect(rateSourceOf(60, offered)).toBe('LAST_QUOTED');
    expect(rateSourceOf(60.5, offered)).toBe('MANUAL');
    // The same figure on two sources counts as the first.
    expect(rateSourceOf(61.25, { ...offered, special: 61.25 })).toBe('SPECIAL');
  });
  it('treats past documents as typed rates for schemes', () => {
    expect(schemeSourceOf('LAST_QUOTED')).toBe('MANUAL');
    expect(schemeSourceOf('SHEET')).toBe('SHEET');
  });
});

describe('invoiceRegime', () => {
  const local = { treatment: 'REGISTERED' as const, placeOfSupply: WB };
  it('charges an invoice invoice by its own place of supply', () => {
    expect(invoiceRegime(US, local, {})).toEqual({ regime: 'INTRA_STATE', split: 'INTRA', placeOfSupply: WB, problem: null });
    // Delivered to Assam: IGST, whatever the buyer's own state.
    expect(invoiceRegime(US, local, { placeOfSupply: '18' })).toEqual({ regime: 'INTER_STATE', split: 'INTER', placeOfSupply: '18', problem: null });
    // A walk-in with no state buys here.
    expect(invoiceRegime(US, { treatment: 'CONSUMER', placeOfSupply: null }, {}).placeOfSupply).toBe(WB);
  });
});

describe('sales when we do not charge GST', () => {
  const local = { treatment: 'REGISTERED' as const, placeOfSupply: WB };
  for (const registration of ['COMPOSITION', 'UNREGISTERED'] as const) {
    const us = { stateCode: WB, registration };
    it(`${registration}: a bill of supply inside our state`, () => {
      expect(saleRegime(us, local)).toEqual({ regime: 'BILL_OF_SUPPLY', split: 'NONE', problem: null });
    });
    it(`${registration}: no sale to another state`, () => {
      expect(saleRegime(us, { ...local, placeOfSupply: '18' }).problem).toMatch(/only inside its own state/);
      expect(invoiceRegime(us, local, { placeOfSupply: '18' }).problem).toMatch(/only inside its own state/);
    });
  }
});
