// What an issued invoice puts in the books: a Sales voucher, booked as
// follows (agent/accounts-plan.md, "What each document posts").
//   Our state:   Dr customer   Cr Sales - GST Local, Output CGST + SGST
//   Other state: Dr customer   Cr Sales - GST Interstate, Output IGST
// Rounding goes to Round Off (a credit when the total was rounded up). The
// cost of the goods is not posted: it leaves closing stock instead
// (closing-stock.ts), as the usual trading account works. Pure.
import type { LedgerRole, SaleRegime } from '../generated/prisma/enums.js';
import type { Posting } from './statements.js';
import type { SystemLedgers } from './system-ledgers.js';
import { voucher, type LedgerRef } from './voucher-lines.js';

export interface PostedInvoice {
  regime: SaleRegime;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
}

export const SALES_LEDGER: Record<SaleRegime, LedgerRole> = {
  INTRA_STATE: 'SALES_LOCAL',
  INTER_STATE: 'SALES_INTERSTATE',
  // Bill of supply (we are composition or unregistered): no output tax.
  BILL_OF_SUPPLY: 'SALES_LOCAL',
};

export function invoicePostings(invoice: PostedInvoice, customer: LedgerRef, ledgers: SystemLedgers): Posting[] {
  return voucher(
    [customer, invoice.total],
    [ledgers(SALES_LEDGER[invoice.regime]), -invoice.taxable],
    [ledgers('OUTPUT_CGST'), -invoice.cgst],
    [ledgers('OUTPUT_SGST'), -invoice.sgst],
    [ledgers('OUTPUT_IGST'), -invoice.igst],
    [ledgers('ROUND_OFF'), -invoice.roundOff],
  );
}
