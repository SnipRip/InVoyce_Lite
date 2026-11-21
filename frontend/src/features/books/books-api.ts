// Paths and display helpers for the chart of accounts and the statements
// (backend/src/books). Amounts arrive debit-positive.
import { formatRate } from "@/lib/format";
import type { LedgerBalanceView, LedgerSource, VoucherSource } from "@/types/ledger";

export const booksPath = (statement: "trial-balance" | "profit-and-loss" | "balance-sheet" | "bank-cash-balances", asOf: string) => `/books/${statement}?asOf=${asOf}`;

/** "₹1,200.00 Dr" / "₹1,200.00 Cr"; zero is a dash. */
export const drCr = (amount: number) => (amount ? `${formatRate(Math.abs(amount))} ${amount > 0 ? "Dr" : "Cr"}` : "–");

/** An amount in its column; zero is blank so the eye finds the figures. */
export const figure = (amount: number) => (amount ? formatRate(amount) : "");

export const SOURCE_LABELS: Record<LedgerSource, string> = {
  ledger: "General ledger",
  head: "Expense & income head",
  bankCash: "Bank & cash",
  loan: "Loan",
  party: "Customer / vendor",
  stock: "Items (opening stock)",
  unlisted: "Not in any master",
};

/** Where a ledger is edited. A party's page depends on the group it sits in. */
export function sourceHref(ledger: LedgerBalanceView, groupName: string): string | null {
  switch (ledger.source) {
    case "ledger":
      return "/masters/ledgers";
    case "head":
      return "/masters/expense-heads";
    case "bankCash":
      return "/masters/bank-cash";
    case "loan":
      return ledger.sourceId ? `/loans/${ledger.sourceId}` : "/loans";
    case "party":
      return ledger.sourceId ? `/${groupName === "Sundry Debtors" ? "customers" : "vendors"}/${ledger.sourceId}` : null;
    case "stock":
      return "/items";
    default:
      return null;
  }
}

export const ledgersPath = (asOf: string) => `/books/ledgers?asOf=${asOf}`;

export const ledgerStatementPath = (ledger: string, from: string, to: string) =>
  `/books/ledger-statement?${new URLSearchParams({ ledger, from, to }).toString()}`;

/** The page of the record a statement row came from. */
export function voucherHref(source: VoucherSource, id: string | null): string | null {
  if (!id) return null;
  switch (source) {
    case "invoice":
      return `/invoices/${id}`;
    case "bill":
      return `/purchases/${id}`;
    case "settlement":
      return `/payments/entries/${id}`;
    case "expense":
      return `/expenses/${id}`;
    case "stockAdjustment":
      return `/stock-adjustments/${id}`;
    case "loan":
      return `/loans/${id}`;
    case "journal":
      return `/journals/${id}`;
    case "creditNote":
      return `/credit-notes/${id}`;
    case "debitNote":
      return `/debit-notes/${id}`;
  }
}

/** Cash book and bank book pick from these groups. */
export const CASH_GROUPS = ["Cash-in-Hand"];
export const BANK_GROUPS = ["Bank Accounts", "Bank OD A/c"];
