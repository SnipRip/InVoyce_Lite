// Credit and debit note calls, and each document a note can be issued
// against, with what is left on its lines and still due on it.
import { apiRequest } from "@/lib/api-client";
import type { InvoiceView } from "@/types/invoice";
import type { CreditNoteView, DebitNoteView, NoteReasonView } from "@/types/note";
import type { PurchaseBillView } from "@/types/purchase";
import type { NoteSplit } from "./note-rules";

export const CREDIT_NOTES_PATH = "/credit-notes";
export const DEBIT_NOTES_PATH = "/debit-notes";

export type NoteKind = "credit" | "debit";

export const NOTE_TEXT = {
  credit: {
    title: "Credit note",
    plural: "Credit notes",
    path: "/credit-notes",
    document: "Invoice",
    goods: "Goods returned by the customer",
    party: "Customer",
    against: "invoice",
  },
  debit: {
    title: "Debit note",
    plural: "Debit notes",
    path: "/debit-notes",
    document: "Bill",
    goods: "Goods sent back to the vendor",
    party: "Vendor",
    against: "bill",
  },
} as const;

export const REASONS: { value: NoteReasonView; label: string }[] = [
  { value: "GOODS_RETURNED", label: "Goods returned" },
  { value: "RATE_DIFFERENCE", label: "Rate difference" },
  { value: "DISCOUNT", label: "Discount after sale" },
  { value: "SHORT_SUPPLY", label: "Short or damaged supply" },
  { value: "OTHER", label: "Other" },
];
export const reasonLabel = (reason: NoteReasonView) => REASONS.find((option) => option.value === reason)?.label ?? reason;

export interface NoteDocumentLine {
  id: string;
  itemName: string;
  unit: string;
  quantity: number;
  taxable: number;
  gstRatePct: number;
  notedQuantity: number;
  notedTaxable: number;
  /** Debit notes: what is still in stock from this bill line. */
  inStock: number | null;
}

/** An invoice or bill a note can be issued against. */
export interface NoteDocument {
  id: string;
  number: string;
  date: string;
  partyName: string;
  /** Still due on it after money and earlier notes. A note settles up to this; the rest is the party's credit. */
  due: number;
  split: NoteSplit;
  lines: NoteDocumentLine[];
}

const splitOf = (totals: { cgst: number; sgst: number; igst: number }): NoteSplit => (totals.igst > 0 ? "INTER" : totals.cgst > 0 || totals.sgst > 0 ? "INTRA" : "NONE");
const money = (value: number) => Math.round(value * 100) / 100;

/** What live notes already took off each document line, by line id. */
function notedByLine(notes: (CreditNoteView | DebitNoteView)[]) {
  const noted = new Map<string, { quantity: number; taxable: number }>();
  for (const note of notes.filter((candidate) => !candidate.cancelledAt)) {
    for (const line of note.lines) {
      const sofar = noted.get(line.documentLineId) ?? { quantity: 0, taxable: 0 };
      noted.set(line.documentLineId, { quantity: sofar.quantity + line.quantity, taxable: money(sofar.taxable + line.taxable) });
    }
  }
  return noted;
}

/** A document with something on its lines a note can still take back. */
const hasSomethingLeft = (document: NoteDocument) => document.lines.some((line) => line.quantity - line.notedQuantity > 0.0005 || line.taxable - line.notedTaxable > 0.005);

/** Issued invoices with something on their lines still to take back. */
export function creditDocuments(invoices: InvoiceView[], notes: CreditNoteView[]): NoteDocument[] {
  const noted = notedByLine(notes);
  return invoices
    .filter((invoice) => invoice.status === "ISSUED")
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      partyName: invoice.partyName,
      due: Math.max(money(invoice.totals.total - invoice.totals.received - invoice.totals.credited), 0),
      split: splitOf(invoice.totals),
      lines: invoice.lines.map((line) => ({
        id: line.id,
        itemName: line.description,
        unit: line.unit,
        quantity: line.quantity,
        taxable: line.taxable,
        gstRatePct: line.gstRatePct,
        notedQuantity: noted.get(line.id)?.quantity ?? 0,
        notedTaxable: noted.get(line.id)?.taxable ?? 0,
        inStock: null,
      })),
    }))
    // Paid or not: goods can come back after payment (the note then leaves credit).
    .filter(hasSomethingLeft);
}

/** Open goods bills (not reverse charge) with something on their lines still to send back. */
export function debitDocuments(bills: PurchaseBillView[], notes: DebitNoteView[]): NoteDocument[] {
  const noted = notedByLine(notes);
  return bills
    .filter((bill) => bill.status === "OPEN" && bill.kind === "GOODS" && bill.regime !== "REVERSE_CHARGE")
    .map((bill) => ({
      id: bill.id,
      number: `${bill.reference} (${bill.vendorBillNumber})`,
      date: bill.date,
      partyName: bill.vendorName,
      due: Math.max(money(bill.totals.payable - bill.totals.paid - bill.totals.debited), 0),
      split: splitOf(bill.totals),
      lines: bill.lines.map((line) => ({
        id: line.id,
        itemName: line.description,
        unit: line.unit,
        quantity: line.quantity,
        taxable: line.taxable,
        gstRatePct: line.gstRatePct,
        notedQuantity: noted.get(line.id)?.quantity ?? 0,
        notedTaxable: noted.get(line.id)?.taxable ?? 0,
        inStock: line.remaining,
      })),
    }))
    // Paid or not: goods can come back after payment (the note then leaves credit).
    .filter(hasSomethingLeft);
}

export interface NoteBody {
  date: string;
  number: string | null;
  reason: NoteReasonView;
  /** False: a value-only note that leaves GST alone. */
  gstAdjusted: boolean;
  notes: string | null;
  lines: { lineId: string; quantity?: number; taxable?: number }[];
}

export const createCreditNote = (invoiceId: string, godownId: string | null, body: NoteBody) =>
  apiRequest<CreditNoteView>(CREDIT_NOTES_PATH, {
    method: "POST",
    body: { ...body, invoiceId, godownId, lines: body.lines.map(({ lineId, ...line }) => ({ invoiceLineId: lineId, ...line })) },
  });

export const createDebitNote = (billId: string, body: NoteBody) =>
  apiRequest<DebitNoteView>(DEBIT_NOTES_PATH, {
    method: "POST",
    body: { ...body, billId, lines: body.lines.map(({ lineId, ...line }) => ({ billLineId: lineId, ...line })) },
  });

export const cancelNote = (kind: NoteKind, id: string, reason: string) =>
  apiRequest<CreditNoteView | DebitNoteView>(`${kind === "credit" ? CREDIT_NOTES_PATH : DEBIT_NOTES_PATH}/${id}/cancel`, { method: "POST", body: { reason } });

export const notePreviewPath = (kind: NoteKind, date: string) => `/number-series/preview?kind=${kind === "credit" ? "CREDIT_NOTE" : "DEBIT_NOTE"}&date=${date}`;
