// The papers that follow an invoice and what each must look like. Pure; the
// frontend's features/invoices/dispatch-documents.ts has the same fields for
// the form. A saved document's details are cleaned here: amounts and weights
// become numbers, codes are upper-cased, blanks are dropped.
import type { DispatchDocumentKind, GstTreatment } from '../generated/prisma/enums.js';

type FieldType = 'text' | 'amount' | 'date' | 'vehicle' | 'ack';

interface DocumentRule {
  name: string;
  numberPattern?: RegExp;
  numberMessage?: string;
  /** IRN in lower case; other numbers as typed (trimmed). */
  normalise?: (number: string) => string;
  fields: Record<string, FieldType>;
}

export const DOCUMENT_RULES: Record<DispatchDocumentKind, DocumentRule> = {
  E_INVOICE: {
    name: 'E-invoice (IRN)',
    numberPattern: /^[0-9a-f]{64}$/,
    numberMessage: 'The IRN is 64 letters (a–f) and digits',
    normalise: (number) => number.toLowerCase(),
    fields: { ackNo: 'ack' },
  },
  LORRY_CHALLAN: {
    name: 'Lorry hire challan',
    fields: { transporter: 'text', vehicle: 'vehicle', freight: 'amount' },
  },
  EWAY_BILL: {
    name: 'E-way bill',
    numberPattern: /^\d{12}$/,
    numberMessage: 'An e-way bill number is 12 digits',
    fields: { validUntil: 'date' },
  },
};

const FIELD_FORMATS: Record<FieldType, { pattern: RegExp; message: string }> = {
  text: { pattern: /^.{1,120}$/s, message: 'is up to 120 characters' },
  amount: { pattern: /^\d{1,12}(\.\d{1,2})?$/, message: 'is an amount in rupees' },
  date: { pattern: /^\d{4}-\d{2}-\d{2}$/, message: 'is a date (YYYY-MM-DD)' },
  vehicle: { pattern: /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/, message: 'is like WB73E1234, no spaces' },
  ack: { pattern: /^\d{15}$/, message: 'is 15 digits' },
};

/** The name inside a sentence: "e-way bill"; a name starting with an abbreviation stays as it is. */
export const nameInText = (kind: DispatchDocumentKind) => {
  const { name } = DOCUMENT_RULES[kind];
  return /^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
};

const NUMERIC: FieldType[] = ['amount'];
const UPPER: FieldType[] = ['vehicle'];

/** Goods above this value move under an e-way bill (CGST rule 138). */
export const EWAY_BILL_LIMIT = 50_000;

/** B2B invoices get an IRN (turnover above ₹5 crore); consumers and unregistered buyers do not. */
export const needsEinvoice = (treatment: GstTreatment) => treatment === 'REGISTERED' || treatment === 'COMPOSITION';

/** Can this kind of paper be attached to this invoice at all? */
export function documentKindProblem(kind: DispatchDocumentKind, treatment: GstTreatment): string | null {
  if (kind === 'E_INVOICE' && !needsEinvoice(treatment)) return 'A sale to a consumer or an unregistered buyer has no IRN';
  return null;
}

/** The number as stored, or why it is wrong. */
export function cleanNumber(kind: DispatchDocumentKind, typed: string): { number: string } | { problem: string } {
  const rule = DOCUMENT_RULES[kind];
  const number = (rule.normalise ?? ((value: string) => value))(typed.trim());
  if (!number) return { problem: 'Enter the document number' };
  if (number.length > 64) return { problem: 'The number is up to 64 characters' };
  if (rule.numberPattern && !rule.numberPattern.test(number)) return { problem: rule.numberMessage ?? 'Check the number' };
  return { number };
}

export type DocumentDetails = Record<string, string | number>;

/** The kind's fields, checked and cleaned; unknown keys are refused, blanks dropped. */
export function cleanDetails(kind: DispatchDocumentKind, typed: Record<string, unknown>): { details: DocumentDetails } | { problem: string } {
  const fields = DOCUMENT_RULES[kind].fields;
  const details: DocumentDetails = {};
  for (const [key, raw] of Object.entries(typed)) {
    const type = fields[key];
    if (!type) return { problem: `A ${nameInText(kind)} has no field "${key}"` };
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') return { problem: `${key} ${FIELD_FORMATS[type].message}` };
    let value = String(raw).trim();
    if (!value) continue;
    if (UPPER.includes(type)) value = value.toUpperCase();
    if (!FIELD_FORMATS[type].pattern.test(value)) return { problem: `${key} ${FIELD_FORMATS[type].message}` };
    details[key] = NUMERIC.includes(type) ? Number(value) : value;
  }
  return { details };
}

/**
 * Dates: a paper follows its invoice, so it is dated on or after it and not
 * after today. An e-way bill is valid until a day on or after it was made.
 */
export function documentDateProblem(document: { date: string; details: DocumentDetails }, invoiceDate: string, today: string): string | null {
  if (document.date < invoiceDate) return 'The document is dated before the invoice';
  if (document.date > today) return 'The document is dated after today';
  const validUntil = document.details.validUntil;
  if (typeof validUntil === 'string' && validUntil < document.date) return 'Valid until is before the e-way bill date';
  return null;
}
