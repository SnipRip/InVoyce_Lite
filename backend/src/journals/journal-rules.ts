// How a journal voucher's lines must fit (client, 12 Nov 2026), and the
// voucher type it is booked as. Pure.
//   - At least two lines, each a debit or a credit of more than zero.
//   - Debits equal credits, to the paisa.
//   - A ledger appears once (on one side), so nothing nets out unseen.
//   - Only bank and cash accounts: a Contra (cash put in the bank, money
//     moved between banks). Bank or cash on one side with other ledgers: a
//     Payment (money out) or Receipt (money in). No bank or cash: a Journal.
//   - A customer's or vendor's ledger (client, 13 Nov 2026) works on one side
//     of their outstanding: RECEIVABLE (what they owe us) or PAYABLE (what we
//     owe them). On it a line either settles what is outstanding (a credit on
//     receivable: a bad debt written off, a discount allowed, a set-off; a
//     debit on payable: a discount received, a set-off) or adds a charge of
//     its own (interest, a bounced cheque, a cost passed on), settled later
//     like any document.
//   - Cash (client yes, 13 Nov 2026): cash a customer or vendor pays in on a
//     journal counts with their cash receipts for the s.269ST limit (refused);
//     cash paid out over ₹10,000 warns (s.40A(3)), as on payments.

export type JournalLedgerKind = 'ledger' | 'head' | 'account' | 'party';
export type PartySide = 'RECEIVABLE' | 'PAYABLE';

/** True when a party line settles what is outstanding on its side; false when it adds a charge. */
export const settlesOutstanding = (side: PartySide, line: { debit: number; credit: number }) => (side === 'RECEIVABLE' ? line.credit > 0 : line.debit > 0);

/** The side a party line works on: the one picked, else the party's only role; or the problem in words (any other string). */
export function partySideOf(party: { displayName: string; isCustomer: boolean; isVendor: boolean; isArchived: boolean }, picked?: PartySide | null): string {
  if (party.isArchived) return `${party.displayName} is archived; restore it first`;
  if (picked === 'RECEIVABLE' && !party.isCustomer) return `${party.displayName} is not a customer: pick what we owe them`;
  if (picked === 'PAYABLE' && !party.isVendor) return `${party.displayName} is not a vendor: pick what they owe us`;
  if (picked) return picked;
  if (party.isCustomer && party.isVendor) return `${party.displayName} is both customer and vendor: say whether the line is on what they owe us or what we owe them`;
  return party.isCustomer ? 'RECEIVABLE' : 'PAYABLE';
}

export interface JournalLineInput {
  kind: JournalLedgerKind;
  id: string;
  debit: number;
  credit: number;
  /** A bank, overdraft or cash account. */
  isMoney: boolean;
}

export type JournalVoucherType = 'Journal' | 'Contra' | 'Payment' | 'Receipt';

const round2 = (value: number) => Math.round(value * 100) / 100;

export const totalsOf = (lines: Pick<JournalLineInput, 'debit' | 'credit'>[]) => ({
  debit: round2(lines.reduce((sum, line) => sum + line.debit, 0)),
  credit: round2(lines.reduce((sum, line) => sum + line.credit, 0)),
});

/** Null when the lines make a voucher, else the first problem in words. */
export function journalProblem(lines: JournalLineInput[]): string | null {
  if (lines.length < 2) return 'A journal needs at least two lines: one debited, one credited';
  for (const [index, line] of lines.entries()) {
    const debit = line.debit > 0;
    const credit = line.credit > 0;
    if (line.debit < 0 || line.credit < 0) return `Line ${index + 1}: amounts cannot be below zero`;
    if (debit === credit) return `Line ${index + 1}: enter a debit or a credit, not ${debit ? 'both' : 'neither'}`;
  }
  const seen = new Set<string>();
  for (const line of lines) {
    const key = `${line.kind}:${line.id}`;
    if (seen.has(key)) return 'A ledger can be on one line only';
    seen.add(key);
  }
  if (!lines.some((line) => line.debit > 0) || !lines.some((line) => line.credit > 0)) return 'Debit one ledger and credit another';
  const { debit, credit } = totalsOf(lines);
  if (debit !== credit) return `Debits (₹${debit.toFixed(2)}) and credits (₹${credit.toFixed(2)}) must be equal; the difference is ₹${Math.abs(round2(debit - credit)).toFixed(2)}`;
  return null;
}

/** The voucher type the lines make, from where bank and cash sit. */
export function journalVoucherType(lines: Pick<JournalLineInput, 'debit' | 'credit' | 'isMoney'>[]): JournalVoucherType {
  const money = lines.filter((line) => line.isMoney);
  if (!money.length) return 'Journal';
  if (money.length === lines.length) return 'Contra';
  const net = round2(money.reduce((sum, line) => sum + line.debit - line.credit, 0));
  return net < 0 ? 'Payment' : 'Receipt';
}

/** Income-tax Act s.40A(3): cash over ₹10,000 to one person in a day is not allowed as a business expense (warned, never refused). */
export const CASH_PAYMENT_LIMIT = 10_000;

export interface CashLineInput {
  kind: JournalLedgerKind;
  id: string;
  debit: number;
  credit: number;
  /** A cash book (not a bank or overdraft account). */
  isCash: boolean;
}

/**
 * The cash each customer or vendor on the voucher paid in (received) or was
 * paid (paid). Cash in or out is the net of the cash lines; a party line on
 * the other side takes it up to its own amount. Several parties on one side
 * may each be counted up to the whole cash, so the limit is never missed.
 */
export function cashByParty(lines: CashLineInput[]): Map<string, { received: number; paid: number }> {
  const net = round2(lines.filter((line) => line.isCash).reduce((sum, line) => sum + line.debit - line.credit, 0));
  const flows = new Map<string, { received: number; paid: number }>();
  if (net === 0) return flows;
  for (const line of lines) {
    if (line.kind !== 'party') continue;
    const received = net > 0 ? Math.min(line.credit, net) : 0;
    const paid = net < 0 ? Math.min(line.debit, -net) : 0;
    if (received > 0 || paid > 0) flows.set(line.id, { received: round2(received), paid: round2(paid) });
  }
  return flows;
}
