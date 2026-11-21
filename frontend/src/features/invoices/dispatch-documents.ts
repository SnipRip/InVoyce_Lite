// The documents attached to an invoice after it is issued, in the order they
// happen: e-invoice registration (IRN), then load and move (challan, e-way bill).
import type { DispatchDocumentKind } from "./types";

export interface DocumentField {
  key: string;
  label: string;
  placeholder?: string;
  /** Checked on entry; message shown when it fails. */
  pattern?: RegExp;
  message?: string;
  inputMode?: "text" | "numeric" | "decimal";
}

export interface DispatchDocumentType {
  kind: DispatchDocumentKind;
  name: string;
  /** Short line under the name. */
  purpose: string;
  stage: "E-invoice" | "Dispatch";
  numberLabel: string;
  numberPattern?: RegExp;
  numberMessage?: string;
  fields: DocumentField[];
}

export const DISPATCH_DOCUMENTS: DispatchDocumentType[] = [
  {
    kind: "e-invoice",
    name: "E-invoice (IRN)",
    purpose: "Registered on the e-invoice portal: the IRN, acknowledgement and signed QR code go on the bill. Needed because turnover is above ₹5 crore",
    stage: "E-invoice",
    numberLabel: "IRN",
    numberPattern: /^[0-9a-f]{64}$/i,
    numberMessage: "The IRN is 64 letters and digits",
    fields: [{ key: "ackNo", label: "Acknowledgement number", inputMode: "numeric", pattern: /^\d{15}$/, message: "15 digits" }],
  },
  {
    kind: "lorry-challan",
    name: "Lorry hire challan",
    purpose: "The truck hired to carry the goods",
    stage: "Dispatch",
    numberLabel: "Challan / LR number",
    fields: [
      { key: "transporter", label: "Transporter", placeholder: "Royal Transport Lines" },
      {
        key: "vehicle",
        label: "Vehicle number",
        placeholder: "WB73E1234",
        pattern: /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/i,
        message: "Like WB73E1234, no spaces",
      },
      { key: "freight", label: "Freight (₹)", inputMode: "decimal", pattern: /^\d+(\.\d{1,2})?$/, message: "Enter an amount" },
    ],
  },
  {
    kind: "eway-bill",
    name: "E-way bill",
    purpose: "Needed above ₹50,000 to move goods by road",
    stage: "Dispatch",
    numberLabel: "E-way bill number",
    numberPattern: /^\d{12}$/,
    numberMessage: "An e-way bill number is 12 digits",
    fields: [{ key: "validUntil", label: "Valid until", placeholder: "YYYY-MM-DD", pattern: /^\d{4}-\d{2}-\d{2}$/, message: "Use YYYY-MM-DD" }],
  },
];

export const documentType = (kind: DispatchDocumentKind) => DISPATCH_DOCUMENTS.find((type) => type.kind === kind)!;
