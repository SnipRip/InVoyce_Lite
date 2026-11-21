// The documents register as the API returns it (GET /documents/register):
// every document number on record and the required papers still missing on
// issued invoices.
import type { DispatchDocumentKind } from '../generated/prisma/enums.js';

export type RegisterKind = DispatchDocumentKind | 'VENDOR_BILL' | 'PURCHASE_EWAY_BILL';

export interface RegisterEntryView {
  kind: RegisterKind;
  number: string;
  date: string;
  /** The invoice or vendor bill it belongs to. */
  owner: { type: 'INVOICE' | 'BILL'; id: string; number: string };
  partyName: string;
  vehicle: string | null;
  /** Its invoice is cancelled or its bill void: kept on record, read-only. */
  cancelled: boolean;
}

export interface MissingPaperView {
  kind: DispatchDocumentKind;
  invoice: { id: string; number: string; date: string };
  partyName: string;
}

export interface DocumentRegisterView {
  entries: RegisterEntryView[];
  missing: MissingPaperView[];
}
