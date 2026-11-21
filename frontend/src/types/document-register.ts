// The documents register as the backend returns it
// (backend/src/document-register/document-register-views.ts).
import type { DispatchDocumentKindView } from "./invoice";

export type RegisterKindView = DispatchDocumentKindView | "VENDOR_BILL" | "PURCHASE_EWAY_BILL";

export interface RegisterEntryView {
  kind: RegisterKindView;
  number: string;
  date: string;
  /** The invoice or vendor bill it belongs to. */
  owner: { type: "INVOICE" | "BILL"; id: string; number: string };
  partyName: string;
  vehicle: string | null;
  /** Its invoice is cancelled or its bill void: kept on record, read-only. */
  cancelled: boolean;
}

export interface MissingPaperView {
  kind: DispatchDocumentKindView;
  invoice: { id: string; number: string; date: string };
  partyName: string;
}

export interface DocumentRegisterView {
  entries: RegisterEntryView[];
  missing: MissingPaperView[];
}
