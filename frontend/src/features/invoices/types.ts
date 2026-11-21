// Sales invoices: a GST tax invoice (or a bill of supply). The documents that
// follow a dispatch (e-invoice, lorry hire challan, e-way bill) are attached
// to the invoice afterwards.
import type { Address } from "@/features/parties/types";
import type { InvoiceView } from "@/types/invoice";

export interface InvoiceLine {
  itemId: string;
  description: string;
  hsn: string;
  /** In `unit`, as entered and printed (any of the item's units). */
  quantity: number;
  unit: string;
  /** Per `unit`, before GST. */
  rate: number;
  discountPct: number;
  gstRatePct: number;
  /** Rupees schemes took off the line (saved invoices and quotations). */
  schemeDiscount?: number;
  /** Base units schemes gave free. */
  freeQuantity?: number;
  /** The item's base unit and how many of it one `unit` holds; absent = `unit` is the base. */
  baseUnit?: string;
  unitFactor?: number;
}

export type DispatchDocumentKind = "e-invoice" | "lorry-challan" | "eway-bill";

/** One attached document: its number, date and kind-specific details. */
export interface DispatchDocument {
  number: string;
  date: string;
  /** Field key → value, as defined for the kind in dispatch-documents.ts. */
  details: Record<string, string>;
}

export interface Invoice {
  id: string;
  /** Up to 16 characters, unique in the financial year (CGST rule 46). */
  number: string;
  date: string;
  status: "draft" | "issued" | "cancelled";
  partyId: string;
  /** GST state code of the place of supply. */
  placeOfSupply?: string;
  shipTo?: Address;
  lines: InvoiceLine[];
  vehicleNumber?: string;
  documents: Partial<Record<DispatchDocumentKind, DispatchDocument>>;
  notes?: string;
  /** The invoice as saved, with what the backend worked out: rate sources, schemes, GST, the stock drawn and its cost. */
  stored?: InvoiceView;
}
