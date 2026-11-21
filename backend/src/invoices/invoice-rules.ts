// What an invoice may be, before it is priced and stock is drawn. Pure.
import type { QuotationStatus } from '../generated/prisma/enums.js';

/** A quotation the customer has been given, or has accepted, can become an invoice once. */
export function conversionProblem(status: QuotationStatus): string | null {
  if (status === 'SENT' || status === 'ACCEPTED') return null;
  if (status === 'CONVERTED') return 'This quotation is already invoiced';
  return `A ${status.toLowerCase()} quotation cannot be invoiced`;
}

/** Each line takes its quantity plus the free units schemes gave out of stock. */
export const quantityOut = (line: { quantity: number; freeQuantity: number }) => Math.round((line.quantity + line.freeQuantity) * 1000) / 1000;
