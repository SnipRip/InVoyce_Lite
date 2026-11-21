// What credit and debit notes put in the books: each is its document's
// voucher turned round, for the part it takes back. Pure.
//   Credit note (sales return, s.34(1)):  Dr Sales Returns (one ledger for
//     every regime, client 13 Nov 2026; gross sales stay as invoiced),
//     Dr Output CGST + SGST / IGST           Cr customer (and IGST Refund
//     Receivable on an export with IGST, as the invoice debited it).
//   Debit note (purchase return, s.34(3)): Dr vendor   Cr the bill's purchase
//     ledger (No Input Credit for lines whose GST was cost), Cr Input GST
//     (the credit given back).
//   A note without GST (a discount not agreed at the sale) leaves sales,
//   purchases and GST alone: Dr Discount Allowed, Cr customer; Dr vendor,
//   Cr Discount Received (round off as the note rounded).
// Goods that move change closing stock (closing-stock.ts), not a ledger.
import type { PurchaseRegime, SaleRegime } from '../generated/prisma/enums.js';
import { billPostings } from './bill-postings.js';
import { invoicePostings, SALES_LEDGER } from './invoice-postings.js';
import type { Posting } from './statements.js';
import type { SystemLedgers } from './system-ledgers.js';
import { voucher, type LedgerRef } from './voucher-lines.js';

/** The same lines with debit and credit swapped. */
export const turnedRound = (lines: Posting[]): Posting[] => lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit }));

export interface PostedCreditNote {
  regime: SaleRegime;
  gstAdjusted: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
}

export function creditNotePostings(note: PostedCreditNote, customer: LedgerRef, ledgers: SystemLedgers): Posting[] {
  if (!note.gstAdjusted) return voucher([ledgers('DISCOUNT_ALLOWED'), note.taxable], [ledgers('ROUND_OFF'), note.roundOff], [customer, -note.total]);
  // The invoice's voucher turned round, its sales ledger swapped for Sales Returns.
  const salesRoles = new Set(Object.values(SALES_LEDGER));
  return turnedRound(invoicePostings(note, customer, (role) => ledgers(salesRoles.has(role) ? 'SALES_RETURNS' : role)));
}

export interface PostedDebitNote {
  regime: PurchaseRegime;
  gstAdjusted: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  itcReversed: number;
  roundOff: number;
  total: number;
  lines: { taxable: number; tax: number; itcEligible: boolean }[];
}

export function debitNotePostings(note: PostedDebitNote, vendor: LedgerRef, ledgers: SystemLedgers): Posting[] {
  if (!note.gstAdjusted) {
    const taxable = note.lines.reduce((sum, line) => sum + line.taxable, 0);
    return voucher([vendor, note.total], [ledgers('DISCOUNT_RECEIVED'), -taxable], [ledgers('ROUND_OFF'), -note.roundOff]);
  }
  return turnedRound(
    billPostings(
      {
        regime: note.regime,
        cgst: note.cgst,
        sgst: note.sgst,
        igst: note.igst,
        tax: note.tax,
        itcClaimable: note.itcReversed,
        roundOff: note.roundOff,
        payable: note.total,
        // A line whose credit was not claimed carries its GST as cost.
        lines: note.lines.map((line) => ({ taxable: line.taxable, ownCost: line.itcEligible && note.itcReversed > 0 ? line.taxable : line.taxable + line.tax, itcEligible: line.itcEligible && note.itcReversed > 0 })),
        charges: [],
      },
      vendor,
      ledgers,
    ),
  );
}
