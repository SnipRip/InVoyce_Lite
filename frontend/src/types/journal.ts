// A journal voucher as the backend returns it (backend/src/journals).
import type { NoteSettlementView } from "./note";

/** ledger: a general ledger; head: an expense or income head; account: a bank or cash account; party: a customer or vendor. */
export type JournalLedgerKind = "ledger" | "head" | "account" | "party";

/** Which side of a party's outstanding a line works on: what they owe us, or what we owe them. */
export type PartySideView = "RECEIVABLE" | "PAYABLE";

export type JournalVoucherType = "Journal" | "Contra" | "Payment" | "Receipt";

export interface JournalLineView {
  lineId: string;
  kind: JournalLedgerKind;
  id: string;
  ledger: string;
  group: string;
  debit: number;
  credit: number;
  partySide: PartySideView | null;
  /** A party line that settles what is outstanding (else it adds a charge). */
  settles: boolean;
  /** Settling line: what its credit settled, and what is left to apply. */
  applied: NoteSettlementView[];
  creditLeft: number;
  /** Charging line: what has been settled on it, and what is still open. */
  settled: number;
  balance: number;
}

export interface JournalView {
  id: string;
  number: string;
  date: string;
  type: JournalVoucherType;
  narration: string | null;
  total: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  lines: JournalLineView[];
}
