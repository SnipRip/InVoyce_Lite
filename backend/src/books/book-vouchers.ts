// Every voucher the books are built from, dated and numbered, and a ledger's
// statement from them: opening balance on the first day, each voucher that
// touches it with the ledger on the other side, a running balance and the
// closing. The cash book and bank book are the statements of a cash or bank
// ledger. Pure: amounts debit-positive, rounded to paise.
import { round2 } from '../loans/loan-schedule.js';
import type { Posting } from './statements.js';

/** Which kind of record made the voucher, so a statement row can link to it. */
export type VoucherSource =
  | 'loan'
  | 'stockAdjustment'
  | 'invoice'
  | 'bill'
  | 'settlement'
  | 'expense'
  | 'journal'
  | 'creditNote'
  | 'debitNote';

export interface BookVoucher {
  date: string;
  /** Sales, Purchase, Receipt, Payment, Journal, Contra, Credit Note, Debit Note. */
  type: string;
  number: string | null;
  source: VoucherSource;
  /** The record's id (for a loan entry, the loan's). */
  sourceId: string | null;
  narration: string | null;
  lines: Posting[];
}

export interface StatementRow {
  date: string;
  type: string;
  number: string | null;
  source: VoucherSource;
  sourceId: string | null;
  /** The ledger on the other side; with several, the largest one and "and others". */
  particulars: string;
  narration: string | null;
  debit: number;
  credit: number;
  /** Debit positive, after this row. */
  balance: number;
}

export interface LedgerStatement {
  ledger: string;
  group: string | null;
  from: string;
  to: string;
  /** Debit positive, at the start of `from`. */
  opening: number;
  rows: StatementRow[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
}

const key = (name: string) => name.trim().toLowerCase();

/** The other side of a voucher for one ledger: the biggest opposite line, and whether there are more. */
export function particularsOf(voucher: BookVoucher, ledger: string, debitSide: boolean): string {
  const others = voucher.lines
    .filter((line) => key(line.ledger) !== key(ledger))
    // The ledger was debited: the other side is what was credited, and the reverse.
    .filter((line) => (debitSide ? line.credit > 0 : line.debit > 0))
    .sort((a, b) => (debitSide ? b.credit - a.credit : b.debit - a.debit));
  if (!others.length) return '(same ledger)';
  const names = [...new Set(others.map((line) => line.ledger))];
  return names.length > 1 ? `${names[0]} and others` : names[0];
}

/**
 * One ledger's statement for `from`..`to` (both YYYY-MM-DD, inclusive).
 * `opening` is the master's opening balance; vouchers before `from` move it.
 * Vouchers on a day keep the order they were given in.
 */
export function ledgerStatement(
  ledger: { name: string; group: string | null; opening: number },
  vouchers: BookVoucher[],
  from: string,
  to: string,
): LedgerStatement {
  const target = key(ledger.name);
  let opening = ledger.opening;
  const rows: StatementRow[] = [];
  const touching = vouchers
    .map((voucher, index) => ({ voucher, index }))
    .filter(({ voucher }) => voucher.date <= to && voucher.lines.some((line) => key(line.ledger) === target))
    .sort((a, b) => a.voucher.date.localeCompare(b.voucher.date) || a.index - b.index);
  let balance = 0;
  let started = false;
  for (const { voucher } of touching) {
    const mine = voucher.lines.filter((line) => key(line.ledger) === target);
    const debit = round2(mine.reduce((sum, line) => sum + line.debit, 0));
    const credit = round2(mine.reduce((sum, line) => sum + line.credit, 0));
    if (voucher.date < from) {
      opening = round2(opening + debit - credit);
      continue;
    }
    if (!started) {
      balance = opening;
      started = true;
    }
    // A ledger on both sides of one voucher shows once, net.
    const net = round2(debit - credit);
    if (net === 0 && debit === 0) continue;
    balance = round2(balance + net);
    rows.push({
      date: voucher.date,
      type: voucher.type,
      number: voucher.number,
      source: voucher.source,
      sourceId: voucher.sourceId,
      particulars: particularsOf(voucher, ledger.name, net > 0),
      narration: voucher.narration,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
      balance,
    });
  }
  const totalDebit = round2(rows.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = round2(rows.reduce((sum, row) => sum + row.credit, 0));
  return {
    ledger: ledger.name,
    group: ledger.group,
    from,
    to,
    opening: round2(opening),
    rows,
    totalDebit,
    totalCredit,
    closing: round2(opening + totalDebit - totalCredit),
  };
}

/**
 * What vouchers in `from`..`to` (other than those `skip` names) put on the
 * ledgers under the given groups: incomes as credits less debits, expenses as
 * debits less credits. Used for the indirect incomes and expenses that the
 * profit report does not already count.
 */
export function movementOn(vouchers: BookVoucher[], ledgersIn: (ledger: string) => boolean, from: string, to: string, skip: ReadonlySet<VoucherSource>): number {
  let total = 0;
  for (const voucher of vouchers) {
    if (voucher.date < from || voucher.date > to || skip.has(voucher.source)) continue;
    for (const line of voucher.lines) if (ledgersIn(line.ledger)) total += line.debit - line.credit;
  }
  return round2(total);
}
