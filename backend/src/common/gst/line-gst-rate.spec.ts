import { describe, expect, it } from 'vitest';
import { lineGstRate } from './line-gst-rate.js';

const item = { name: 'TMT 12mm', gstRatePct: 18 };

describe('lineGstRate', () => {
  it('takes the HSN rate when none is typed', () => {
    expect(lineGstRate({ item, enforce: false, applicable: true })).toEqual({ rate: 18 });
    expect(lineGstRate({ item, typed: null, enforce: true, applicable: true })).toEqual({ rate: 18 });
  });

  it('keeps a typed rate when the company does not enforce the HSN rate', () => {
    expect(lineGstRate({ item, typed: 12, enforce: false, applicable: true })).toEqual({ rate: 12 });
    expect(lineGstRate({ item, typed: 0, enforce: false, applicable: true })).toEqual({ rate: 0 });
  });

  it('refuses a different rate when the HSN rate is enforced', () => {
    expect(lineGstRate({ item, typed: 12, enforce: true, applicable: true }).problem).toMatch(/takes 18% GST/);
    expect(lineGstRate({ item, typed: 18, enforce: true, applicable: true })).toEqual({ rate: 18 });
  });

  it('needs a rate from somewhere', () => {
    const bare = { name: 'Loose wire', gstRatePct: null };
    expect(lineGstRate({ item: bare, enforce: false, applicable: true }).problem).toMatch(/no GST rate/);
    expect(lineGstRate({ item: bare, typed: 5, enforce: false, applicable: true })).toEqual({ rate: 5 });
    expect(lineGstRate({ item: bare, typed: 5, enforce: true, applicable: true }).problem).toMatch(/no GST rate/);
  });

  it('is 0% on a document without GST', () => {
    expect(lineGstRate({ item, typed: 18, enforce: true, applicable: false })).toEqual({ rate: 0 });
  });
});
