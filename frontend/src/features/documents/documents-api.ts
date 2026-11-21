// The dispatch documents register on the backend (GET /documents/register)
// and the names the screen shows. Which papers are required is decided on the
// server (backend/src/document-register).
import { documentType } from "@/features/invoices/dispatch-documents";
import { KIND_OF } from "@/features/invoices/invoices-api";
import type { DispatchDocumentKindView } from "@/types/invoice";
import type { RegisterEntryView, RegisterKindView } from "@/types/document-register";

export const DOCUMENT_REGISTER_PATH = "/documents/register";

/** A dispatch document's name, as on the invoice page. */
export const documentName = (kind: DispatchDocumentKindView) => documentType(KIND_OF[kind]).name;

const PURCHASE_KIND_NAMES: Record<"VENDOR_BILL" | "PURCHASE_EWAY_BILL", string> = {
  VENDOR_BILL: "Vendor bill",
  PURCHASE_EWAY_BILL: "E-way bill (purchase)",
};

export const registerKindName = (kind: RegisterKindView) =>
  kind === "VENDOR_BILL" || kind === "PURCHASE_EWAY_BILL" ? PURCHASE_KIND_NAMES[kind] : documentName(kind);

/** Every kind the register can hold, in the order papers happen. */
export const REGISTER_KINDS: RegisterKindView[] = ["E_INVOICE", "LORRY_CHALLAN", "EWAY_BILL", "VENDOR_BILL", "PURCHASE_EWAY_BILL"];

export const ownerHref = (owner: RegisterEntryView["owner"]) => (owner.type === "INVOICE" ? `/invoices/${owner.id}` : `/purchases/${owner.id}`);
