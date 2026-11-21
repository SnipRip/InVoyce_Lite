// Credit and debit notes as the backend returns them (backend/src/notes).
import type { SaleRegimeView } from "./quotation";

export type NoteReasonView = "GOODS_RETURNED" | "RATE_DIFFERENCE" | "DISCOUNT" | "SHORT_SUPPLY" | "OTHER";

export interface NoteLineView {
  id: string;
  /** The invoice line or bill line it takes back from. */
  documentLineId: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  unit: string;
  quantity: number;
  taxable: number;
  gstRatePct: number;
  tax: number;
  cost: number;
}

interface NoteViewBase {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  reason: NoteReasonView;
  /** False: a note without GST (a discount not agreed at the sale). */
  gstAdjusted: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  total: number;
  cost: number;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  lines: NoteLineView[];
  /** What the note takes off the party. */
  partyAmount: number;
  /** What it settles: its own document first, then any it was applied to later. */
  settles: NoteSettlementView[];
  /** Live refunds of its credit. */
  refunds: { id: string; number: string; date: string; amount: number }[];
  /** Still the party's credit: to apply to another document or refund. */
  creditLeft: number;
}

export interface NoteSettlementView {
  kind: "INVOICE" | "BILL" | "EXPENSE" | "OPENING" | "JOURNAL";
  /** JOURNAL: the journal the charging line is on. */
  journalId?: string;
  documentId: string;
  number: string;
  amount: number;
  appliedAt: string;
}

export interface CreditNoteView extends NoteViewBase {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  regime: SaleRegimeView;
  godownId: string | null;
  godownName: string | null;
  usedSince: boolean;
}

export interface DebitNoteView extends NoteViewBase {
  billId: string;
  billReference: string;
  vendorBillNumber: string;
  billDate: string;
  itcReversed: number;
}

/** A note as its document lists it. */
export interface NoteSummaryView {
  id: string;
  number: string;
  date: string;
  total: number;
}
