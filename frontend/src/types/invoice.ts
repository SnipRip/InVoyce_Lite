// Sales invoices as the backend returns them (backend/src/invoices).
import type { EnteredLineView } from "./entered-line";
import type { DocumentBranch } from "./party";
import type { NoteSummaryView } from "./note";
import type { LineRateSourceView, SaleRegimeView } from "./quotation";
import type { AppliedSchemeView } from "./scheme";
import type { StockDrawView } from "./stock-moves";

export type InvoiceStatusView = "ISSUED" | "CANCELLED";

/** One FIFO slice of a line's goods, with where it came from (a bill, a transfer in, an adjustment, the opening stock). */
export type InvoiceDrawView = StockDrawView;

export interface InvoiceLineView {
  id: string;
  itemId: string;
  description: string;
  hsn: string;
  unit: string;
  quantity: number;
  rate: number;
  /** As entered and printed; quantity and rate above are per base unit. */
  entered: EnteredLineView;
  discountPct: number;
  rateSource: LineRateSourceView;
  suggestedRate: number | null;
  schemeDiscount: number;
  freeQuantity: number;
  schemes: AppliedSchemeView[];
  gstRatePct: number;
  taxable: number;
  tax: number;
  /** What the goods sent out (free units too) cost, from the draws. */
  costOfGoods: number;
  /** Oldest first; empty once the invoice is cancelled. */
  draws: InvoiceDrawView[];
}

export type DispatchDocumentKindView = "E_INVOICE" | "LORRY_CHALLAN" | "EWAY_BILL";

/** One attached dispatch document; amounts and weights in `details` are numbers. */
export interface InvoiceDocumentView {
  kind: DispatchDocumentKindView;
  number: string;
  date: string;
  details: Record<string, string | number>;
  updatedAt: string;
  /** Scans and PDFs kept with it. */
  files: { id: string; name: string; contentType: string; size: number }[];
}

export interface InvoiceView {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  /** Null: the customer's main branch. */
  billTo: DocumentBranch | null;
  /** Null: delivered to the bill-to address (or the typed ship-to). */
  shipTo: DocumentBranch | null;
  godownId: string;
  godownName: string;
  status: InvoiceStatusView;
  regime: SaleRegimeView;
  /** False: entered without GST (every line at 0%). */
  gstApplicable: boolean;
  placeOfSupply: string | null;
  shipToLine: string | null;
  shipToCity: string | null;
  vehicleNumber: string | null;
  /** Picked from the vehicle master; null when typed. */
  vehicleId: string | null;
  notes: string | null;
  quotation: { id: string; label: string } | null;
  totals: {
    gross: number;
    schemeDiscount: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    roundOff: number;
    total: number;
    /** Live receipts (and TDS) applied so far. */
    received: number;
    /** Taken off by live credit notes. */
    credited: number;
    cost: number;
  };
  /** Live credit notes against this invoice, oldest first. */
  creditNotes: NoteSummaryView[];
  lines: InvoiceLineView[];
  /** In the order they happen. */
  documents: InvoiceDocumentView[];
  cancelledAt: string | null;
  cancelReason: string | null;
}
