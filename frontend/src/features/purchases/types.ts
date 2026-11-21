// Vendor bills under Indian GST. Two kinds: a goods bill brings
// stock in; a charges bill is freight, loading, unloading or labour, which
// can be tagged to a goods bill so its cost lands on those items.
import type { InvoiceLine } from "@/features/invoices/types";
import type { AccountHead } from "@/features/masters/types";
import type { PurchaseBillView } from "@/types/purchase";

export type BillKind = "goods" | "charges";

/** A charge's expense head (Expense & income heads): what the bill rules read from it. */
export type ChargeHead = Pick<AccountHead, "id" | "name" | "gst" | "gstRatePct" | "allocation">;

/** Per-line input credit eligibility. Ineligible GST (Section 17(5)) becomes cost. */
export type ItcEligibility = "eligible" | "ineligible";

/** A goods line. Same shape as an invoice line: HSN, unit and GST come from the item. */
export interface BillLine extends InvoiceLine {
  itc: ItcEligibility;
}

export interface BillCharge {
  /** The expense head's id; sample bills name it by its ledger name (findHead matches both). */
  head: string;
  description?: string;
  /** Before GST. */
  amount: number;
  /**
   * Charges bills: the rate printed on the vendor's bill. On a goods bill the
   * charge always takes the bill's own rate, so this is left out.
   */
  gstRatePct?: number;
}

/** How tagged charges spread over a goods bill's items. */
export type LandedCostMethod = "value" | "quantity" | "weight";

export interface EwayBillRecord {
  /** 12 digits. */
  number: string;
  date: string;
  vehicleNumber?: string;
}

export interface Bill {
  id: string;
  kind: BillKind;
  /** Our own series, PUR/2627/0001. */
  reference: string;
  /** As printed on the vendor's bill. */
  vendorBillNumber: string;
  date: string;
  dueDate: string;
  status: "draft" | "open" | "void";
  vendorId: string;
  /** The vendor's branch that billed us; undefined = its main branch. */
  vendorBranchId?: string;
  /** GST state the goods or service come from: the billing branch's state. */
  sourceOfSupply?: string;
  lines: BillLine[];
  /** Goods bills: charges printed on the same bill. Charges bills: the bill itself. */
  charges: BillCharge[];
  ewayBill?: EwayBillRecord;
  /** Charges bills: the goods bill whose items carry this cost. */
  landedCostFor?: string;
  /** Goods bills. */
  allocation: LandedCostMethod;
  /** Paid so far: live vendor payments (and TDS) applied to the bill; each one is in `stored.payments`. */
  paid: number;
  /** Taken off by live debit notes. */
  debited: number;
  notes?: string;
  /** The bill as saved, with the figures the backend worked out (landed rates, godown, order). */
  stored?: PurchaseBillView;
}
