// Invoice arithmetic and status. No React. The backend prices saved invoices
// (backend/src/invoices); this gives the same figures for the printed copy
// and the sample invoices other screens still read.
//
// Taxable value = quantity × rate less discount, less what schemes took off.
// GST per line follows the regime from gst-rules.ts; totals round to the
// rupee with a round-off line.
import { saleTax, taxComponents, type Regime, type TaxComponent, type TaxDecision } from "@/features/gst/gst-rules";
import type { Party } from "@/features/parties/types";
import { DISPATCH_DOCUMENTS } from "./dispatch-documents";
import type { DispatchDocumentKind, Invoice, InvoiceLine } from "./types";
import type { OurRegistration } from "@/types/company";

const money = (value: number) => Math.round(value * 100) / 100;


/**
 * The tax regime of an invoice: its own place of supply (it can differ from
 * the party's, e.g. delivery to another state).
 */
export function invoiceTax(company: OurRegistration, invoice: Pick<Invoice, "placeOfSupply">, party: Pick<Party, "treatment">): TaxDecision {
  return saleTax(company, { treatment: party.treatment, stateCode: invoice.placeOfSupply });
}

export interface LineTotals {
  taxable: number;
  taxes: (TaxComponent & { amount: number })[];
  total: number;
}

export function lineTotals(line: InvoiceLine, regime: Regime): LineTotals {
  const taxable = money(money(line.quantity * line.rate * (1 - line.discountPct / 100)) - (line.schemeDiscount ?? 0));
  const taxes = taxComponents(line.gstRatePct, regime).map((component) => ({
    ...component,
    amount: money((taxable * component.ratePct) / 100),
  }));
  return { taxable, taxes, total: money(taxable + taxes.reduce((sum, tax) => sum + tax.amount, 0)) };
}

export interface InvoiceTotals {
  taxable: number;
  /** Summed by tax name: CGST, SGST, IGST. */
  taxByName: Partial<Record<TaxComponent["name"], number>>;
  tax: number;
  roundOff: number;
  grandTotal: number;
}

export function invoiceTotals(lines: InvoiceLine[], regime: Regime): InvoiceTotals {
  const taxByName: InvoiceTotals["taxByName"] = {};
  let taxable = 0;
  for (const line of lines) {
    const totals = lineTotals(line, regime);
    taxable += totals.taxable;
    for (const tax of totals.taxes) taxByName[tax.name] = money((taxByName[tax.name] ?? 0) + tax.amount);
  }
  const tax = money(Object.values(taxByName).reduce((sum, amount) => sum + (amount ?? 0), 0));
  const exact = money(taxable + tax);
  const grandTotal = Math.round(exact);
  return { taxable: money(taxable), taxByName, tax, roundOff: money(grandTotal - exact), grandTotal };
}

/** HSN-wise summary printed under the lines. */
export function hsnSummary(lines: InvoiceLine[], regime: Regime) {
  const rows = new Map<string, { hsn: string; ratePct: number; taxable: number; tax: number }>();
  for (const line of lines) {
    const totals = lineTotals(line, regime);
    const key = `${line.hsn}-${line.gstRatePct}`;
    const row = rows.get(key) ?? { hsn: line.hsn, ratePct: line.gstRatePct, taxable: 0, tax: 0 };
    row.taxable = money(row.taxable + totals.taxable);
    row.tax = money(row.tax + totals.taxes.reduce((sum, tax) => sum + tax.amount, 0));
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** One series per financial year: INV/2627/0007. */
export function invoiceNumber(financialYear: string, sequence: number) {
  const year = financialYear.replace("-", "").slice(2);
  return `INV/${year}/${String(sequence).padStart(4, "0")}`;
}

/** West Bengal's e-way bill limit for movement inside the state, and the all-India limit. */
export const EWAY_BILL_LIMIT = 50000;

/**
 * E-invoicing applies (turnover above ₹5 crore) to B2B invoices. Sales to
 * consumers and unregistered buyers (B2C) do not get an IRN.
 */
export const needsEinvoice = (party: Pick<Party, "treatment">, company: OurRegistration) =>
  company.registration === "REGULAR" && (party.treatment === "registered" || party.treatment === "composition");

/** Is this document required on this invoice? The e-way bill only above the limit. */
export function isDocumentRequired(kind: DispatchDocumentKind, grandTotal: number, einvoice: boolean) {
  if (kind === "e-invoice") return einvoice;
  if (kind === "eway-bill") return grandTotal > EWAY_BILL_LIMIT;
  return false;
}

/** Required documents still to attach. */
export function missingDocuments(invoice: Invoice, grandTotal: number, einvoice: boolean): DispatchDocumentKind[] {
  return DISPATCH_DOCUMENTS.map((type) => type.kind).filter((kind) => !invoice.documents[kind] && isDocumentRequired(kind, grandTotal, einvoice));
}

export type InvoiceStage = "Draft" | "Issued" | "Dispatched" | "Cancelled";

/** Where the invoice is in its life, from the documents attached so far. */
export function invoiceStage(invoice: Invoice): InvoiceStage {
  if (invoice.status === "cancelled") return "Cancelled";
  if (invoice.status === "draft") return "Draft";
  const has = (kind: DispatchDocumentKind) => Boolean(invoice.documents[kind]);
  if (has("lorry-challan") || has("eway-bill")) return "Dispatched";
  return "Issued";
}
