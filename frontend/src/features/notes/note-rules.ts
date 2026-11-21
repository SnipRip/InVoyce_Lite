// The note figures in the browser, the same way the server works them out
// (backend/src/notes/note-rules.ts), so the form shows what will be saved.
import type { NoteDocumentLine } from "./notes-api";

export type NoteSplit = "INTRA" | "INTER" | "NONE";

const money = (value: number) => Math.round(value * 100) / 100;
const qty = (value: number) => Math.round(value * 1000) / 1000;

export interface NoteLinePreview {
  quantity: number;
  taxable: number;
  tax: number;
}

export const quantityLeft = (line: NoteDocumentLine) => qty(line.quantity - line.notedQuantity);
export const taxableLeft = (line: NoteDocumentLine) => money(line.taxable - line.notedTaxable);

/** Tax as the server splits it: CGST and SGST each rounded, or IGST in one. */
function taxOn(taxable: number, ratePct: number, split: NoteSplit) {
  if (split === "NONE") return 0;
  if (split === "INTER") return money((taxable * ratePct) / 100);
  return money(2 * money((taxable * ratePct) / 2 / 100));
}

/** A line's figures, or the problem in words, or null when nothing is entered. */
export function previewLine(line: NoteDocumentLine, input: { quantity: string; taxable: string }, goods: boolean, split: NoteSplit): NoteLinePreview | string | null {
  if (goods) {
    const back = qty(Number(input.quantity) || 0);
    if (!back) return null;
    if (back > quantityLeft(line)) return `Only ${quantityLeft(line)} ${line.unit} can still come back`;
    if (line.inStock !== null && back > line.inStock) return `Only ${line.inStock} ${line.unit} from this bill is still in stock`;
    const taxable = back === quantityLeft(line) ? taxableLeft(line) : money((line.taxable / line.quantity) * back);
    return { quantity: back, taxable, tax: taxOn(taxable, line.gstRatePct, split) };
  }
  const taxable = money(Number(input.taxable) || 0);
  if (!taxable) return null;
  if (taxable > taxableLeft(line)) return `Only ₹${taxableLeft(line).toFixed(2)} of its value is left`;
  return { quantity: 0, taxable, tax: taxOn(taxable, line.gstRatePct, split) };
}

export function previewTotals(lines: NoteLinePreview[]) {
  const taxable = money(lines.reduce((sum, line) => sum + line.taxable, 0));
  const tax = money(lines.reduce((sum, line) => sum + line.tax, 0));
  const total = Math.round(money(taxable + tax));
  return { taxable, tax, roundOff: money(total - taxable - tax), total };
}
