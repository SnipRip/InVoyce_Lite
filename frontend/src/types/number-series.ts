// Numbering as the backend returns it (backend/src/number-series).

/** Everything the client numbers (NumberedKind in prisma/schema.prisma). */
export type NumberedKind =
  | "QUOTATION"
  | "SALES_INVOICE"
  | "PURCHASE_ORDER"
  | "PURCHASE"
  | "RECEIPT"
  | "PAYMENT"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "JOURNAL"
  | "STOCK_JOURNAL"
  | "STOCK_TRANSFER"
  | "DELIVERY_CHALLAN"
  | "EXPENSE"
  | "CUSTOMER_CODE"
  | "VENDOR_CODE"
  | "ITEM_SKU";

/** the usual voucher numbering methods. */
export type NumberingMethod = "AUTOMATIC" | "AUTOMATIC_MANUAL_OVERRIDE" | "MANUAL";

export type NumberReset = "YEARLY" | "MONTHLY" | "NEVER";

export interface NumberFormatView {
  id: string;
  applicableFrom: string;
  /** "INV/{FY}/{SEQ:4}". */
  pattern: string;
  startNumber: number;
  reset: NumberReset;
  issuedCount: number;
  /** Has given out a number: cannot change or be deleted. */
  locked: boolean;
}

export interface NumberSeriesView {
  id: string;
  kind: NumberedKind;
  method: NumberingMethod;
  voucherType: string | null;
  /** Newest first. */
  formats: NumberFormatView[];
  /** The format in force on the requested date and the number a save would take. */
  current: { formatId: string; next: string } | null;
  /** This financial year (master codes: all time), as GSTR-1 table 13 counts it. */
  issued: { period: string; total: number; cancelled: number; first: string | null; last: string | null };
}

export interface IssuedNumberView {
  id: string;
  number: string;
  documentDate: string;
  formatId: string | null;
  status: "ISSUED" | "CANCELLED";
  documentId: string | null;
}
