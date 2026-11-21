// Credit and debit notes (CGST Act s.34; client, 12 Nov 2026). Pure.
//   - A note follows its document: each line at the document line's own GST
//     rate, split the way the document was charged (CGST + SGST, IGST, none).
//   - Goods returned: the value is the line's taxable value per unit (after
//     its discounts and schemes) times what came back; never more than was
//     sold or billed, counting earlier live notes.
//   - Value only (a rate difference, a discount after the sale, short
//     supply): an amount typed per line, never more than the line has left.
//   - A credit note that cuts GST must be issued by 30 November after the end
//     of the financial year of the invoice (s.34(2) as amended in 2022).
//   - It settles its own document up to what is still due; the rest is the
//     party's credit (settleOnDocument).
//   - A value-only note may leave GST alone (client, 13 Nov 2026): a discount
//     not agreed before the sale does not lower the taxable value (s.15(3)(b)),
//     so the note is a financial one, with no tax (withoutGstProblem).
import { sumTax, taxOn, type TaxAmounts, type TaxSplit } from '../common/gst/tax-split.js';

const money = (value: number) => Math.round(value * 100) / 100;
const qty = (value: number) => Math.round(value * 1000) / 1000;

/** How a document charged GST, read from what it charged. */
export function splitOf(document: { cgst: number; sgst: number; igst: number }): TaxSplit {
  if (document.igst > 0) return 'INTER';
  if (document.cgst > 0 || document.sgst > 0) return 'INTRA';
  return 'NONE';
}

/** A document line as the note sees it: what it sold or billed, and what live notes already took. */
export interface NotedLine {
  label: string;
  quantity: number;
  taxable: number;
  gstRatePct: number;
  /** Cost per base unit: the invoice line's cost of goods, or the bill batch's landed rate. */
  unitCost: number;
  notedQuantity: number;
  notedTaxable: number;
}

export interface NoteLineInput {
  /** Base units back; 0 or absent for a value-only line. */
  quantity?: number;
  /** Value-only lines: the taxable amount to take off. Ignored when goods come back. */
  taxable?: number;
}

export interface NoteLineFigures {
  quantity: number;
  taxable: number;
  tax: number;
  taxes: TaxAmounts;
  cost: number;
}

/** One note line's figures, or the problem in words. */
export function noteLineFigures(line: NotedLine, input: NoteLineInput, split: TaxSplit): NoteLineFigures | string {
  const quantityLeft = qty(line.quantity - line.notedQuantity);
  const taxableLeft = money(line.taxable - line.notedTaxable);
  const returned = qty(input.quantity ?? 0);
  let taxable: number;
  if (returned > 0) {
    if (returned > quantityLeft) return `${line.label}: only ${quantityLeft} can still come back`;
    // The last units back take whatever value is left, so rounding never strands a paisa.
    taxable = returned === quantityLeft ? taxableLeft : money((line.taxable / line.quantity) * returned);
  } else {
    taxable = money(input.taxable ?? 0);
    if (taxable <= 0) return `${line.label}: enter the quantity back or the amount to take off`;
  }
  if (taxable > taxableLeft) return `${line.label}: only ₹${taxableLeft.toFixed(2)} of its value is left to take off`;
  const taxes = taxOn(taxable, line.gstRatePct, split);
  return { quantity: returned, taxable, tax: sumTax(taxes), taxes, cost: money(line.unitCost * returned) };
}

export interface NoteTotals extends TaxAmounts {
  taxable: number;
  tax: number;
  roundOff: number;
  total: number;
  cost: number;
}

/** The note's totals, rounded to the rupee as the document was. */
export function noteTotals(lines: NoteLineFigures[]): NoteTotals {
  const add = (pick: (line: NoteLineFigures) => number) => money(lines.reduce((sum, line) => sum + pick(line), 0));
  const taxable = add((line) => line.taxable);
  const cgst = add((line) => line.taxes.cgst);
  const sgst = add((line) => line.taxes.sgst);
  const igst = add((line) => line.taxes.igst);
  const tax = money(cgst + sgst + igst);
  const exact = money(taxable + tax);
  const total = Math.round(exact);
  return { taxable, cgst, sgst, igst, tax, roundOff: money(total - exact), total, cost: add((line) => line.cost) };
}

/** A note without GST: only for a value-only reason, never for goods coming back (a return always reverses its GST). */
export function withoutGstProblem(gstAdjusted: boolean, reason: string): string | null {
  if (gstAdjusted) return null;
  if (reason === 'GOODS_RETURNED') return 'Goods returned always take their GST back; a note without GST is for a discount or price change only';
  return null;
}

/** 30 November after the financial year a document's date falls in (YYYY-MM-DD). */
export function creditNoteDeadline(documentDate: string): string {
  const year = Number(documentDate.slice(0, 4));
  const month = Number(documentDate.slice(5, 7));
  const yearEnd = month >= 4 ? year + 1 : year;
  return `${yearEnd}-11-30`;
}

/** Date checks: on or after the document, not after today, and (GST cut) by the deadline. */
export function noteDateProblem(noteDate: string, documentDate: string, today: string, cutsGst: boolean): string | null {
  if (noteDate < documentDate) return 'The note cannot be dated before its document';
  if (noteDate > today) return 'The note cannot be dated after today';
  const deadline = creditNoteDeadline(documentDate);
  if (cutsGst && noteDate > deadline) return `GST on this document can be reduced only by ${deadline} (CGST Act s.34(2)); the date is later`;
  return null;
}

/**
 * How a note's amount settles (client, 13 Nov 2026): its own document first,
 * up to what is still due there; anything over that (goods returned after the
 * document was paid) is the party's credit, applied later to another of their
 * documents or refunded. `partyAmount` is what the note takes off the party:
 * a credit note on an export with IGST takes off the goods value only.
 */
export function settleOnDocument(partyAmount: number, stillDue: number): { onDocument: number; credit: number } {
  const onDocument = money(Math.max(Math.min(partyAmount, stillDue), 0));
  return { onDocument, credit: money(partyAmount - onDocument) };
}
