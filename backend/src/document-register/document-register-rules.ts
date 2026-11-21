// Which papers an invoice must carry before its goods move, pure. Built on
// the dispatch document rules (invoices/dispatch-document-rules.ts), so the
// register never asks for a paper an invoice cannot take.
import type { DispatchDocumentKind, GstTreatment } from '../generated/prisma/enums.js';
import { EWAY_BILL_LIMIT, needsEinvoice } from '../invoices/dispatch-document-rules.js';

export interface InvoicePaperFacts {
  /** The buyer's GST treatment (decides the IRN). */
  treatment: GstTreatment;
  /** Grand total, for the e-way bill limit. */
  total: number;
}

/** A B2B invoice needs its IRN, and any invoice above the limit an e-way bill. */
export function requiredPapers(invoice: InvoicePaperFacts): DispatchDocumentKind[] {
  const papers: DispatchDocumentKind[] = [];
  if (needsEinvoice(invoice.treatment)) papers.push('E_INVOICE');
  if (invoice.total > EWAY_BILL_LIMIT) papers.push('EWAY_BILL');
  return papers;
}
