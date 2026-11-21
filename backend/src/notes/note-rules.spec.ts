import { describe, expect, it } from 'vitest';
import { creditNoteDeadline, settleOnDocument, withoutGstProblem, noteDateProblem, noteLineFigures, noteTotals, splitOf, type NoteLineFigures, type NotedLine } from './note-rules.js';

// 10 bags sold at ₹350 after a 5% discount: taxable 3,325, 18% GST, cost ₹280 a bag.
const cement: NotedLine = { label: 'Cement', quantity: 10, taxable: 3325, gstRatePct: 18, unitCost: 280, notedQuantity: 0, notedTaxable: 0 };

describe('noteLineFigures', () => {
  it('values goods back at the line’s own price after discount, with its GST and cost', () => {
    const figures = noteLineFigures(cement, { quantity: 2 }, 'INTRA') as NoteLineFigures;
    expect(figures).toMatchObject({ quantity: 2, taxable: 665, tax: 119.7, cost: 560 });
    expect(figures.taxes).toEqual({ cgst: 59.85, sgst: 59.85, igst: 0 });
  });

  it('charges IGST on an inter-state line and nothing on a no-GST one', () => {
    expect((noteLineFigures(cement, { quantity: 1 }, 'INTER') as NoteLineFigures).taxes).toEqual({ cgst: 0, sgst: 0, igst: 59.85 });
    expect((noteLineFigures(cement, { quantity: 1 }, 'NONE') as NoteLineFigures).tax).toBe(0);
  });

  it('never takes back more than was sold, counting earlier notes', () => {
    const half = { ...cement, notedQuantity: 8, notedTaxable: 2660 };
    expect(noteLineFigures(half, { quantity: 3 }, 'INTRA')).toMatch(/only 2 can still come back/);
    // The last units take what is left, to the paisa.
    expect((noteLineFigures(half, { quantity: 2 }, 'INTRA') as NoteLineFigures).taxable).toBe(665);
  });

  it('takes a typed value off without goods, within what is left', () => {
    expect(noteLineFigures(cement, { taxable: 300 }, 'INTRA')).toMatchObject({ quantity: 0, taxable: 300, tax: 54, cost: 0 });
    expect(noteLineFigures(cement, { taxable: 4000 }, 'INTRA')).toMatch(/only ₹3325\.00/);
    expect(noteLineFigures(cement, {}, 'INTRA')).toMatch(/enter the quantity back or the amount/);
  });
});

describe('noteTotals', () => {
  it('adds the lines and rounds the total to the rupee', () => {
    const a = noteLineFigures(cement, { quantity: 1 }, 'INTRA') as NoteLineFigures;
    const totals = noteTotals([a]);
    expect(totals).toMatchObject({ taxable: 332.5, cgst: 29.93, sgst: 29.93, tax: 59.86, total: 392, roundOff: -0.36, cost: 280 });
  });
});

describe('splitOf', () => {
  it('reads the split from what the document charged', () => {
    expect(splitOf({ cgst: 9, sgst: 9, igst: 0 })).toBe('INTRA');
    expect(splitOf({ cgst: 0, sgst: 0, igst: 18 })).toBe('INTER');
    expect(splitOf({ cgst: 0, sgst: 0, igst: 0 })).toBe('NONE');
  });
});

describe('dates', () => {
  it('finds 30 November after the financial year', () => {
    expect(creditNoteDeadline('2026-11-12')).toBe('2027-11-30');
    expect(creditNoteDeadline('2027-02-10')).toBe('2027-11-30');
    expect(creditNoteDeadline('2027-04-01')).toBe('2028-11-30');
  });

  it('keeps the note between its document and today, and GST cuts by the deadline', () => {
    expect(noteDateProblem('2026-11-01', '2026-11-05', '2026-11-12', true)).toMatch(/before its document/);
    expect(noteDateProblem('2026-11-13', '2026-11-05', '2026-11-12', true)).toMatch(/after today/);
    expect(noteDateProblem('2027-12-01', '2026-11-05', '2028-01-01', true)).toMatch(/by 2027-11-30/);
    expect(noteDateProblem('2027-12-01', '2026-11-05', '2028-01-01', false)).toBeNull();
  });
});

describe('settleOnDocument', () => {
  it('settles the document when it covers the note', () => {
    expect(settleOnDocument(500, 800)).toEqual({ onDocument: 500, credit: 0 });
  });
  it('leaves the excess as the party’s credit when the document is (part) paid', () => {
    expect(settleOnDocument(500, 200)).toEqual({ onDocument: 200, credit: 300 });
    expect(settleOnDocument(500, 0)).toEqual({ onDocument: 0, credit: 500 });
  });
});

describe('withoutGstProblem', () => {
  it('lets a value-only note leave GST alone, never a return of goods', () => {
    expect(withoutGstProblem(true, 'GOODS_RETURNED')).toBeNull();
    expect(withoutGstProblem(false, 'DISCOUNT')).toBeNull();
    expect(withoutGstProblem(false, 'GOODS_RETURNED')).toMatch(/always take their GST back/);
  });
});
