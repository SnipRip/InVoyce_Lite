"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { LoadNotice } from "@/components/ui/load-notice";
import { StatusChip } from "@/components/ui/status-chip";
import { apiGet } from "@/lib/api-client";
import { financialYearOf } from "@/lib/financial-year";
import { formatDate, formatInr, formatQuantity, formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { BankCashAccountView } from "@/types/bank-cash";
import type { BankCashBalanceView } from "@/types/ledger";
import { booksPath } from "../books/books-api";
import { BANK_CASH_PATH, bankCashPersistence, toMoneyAccount, withArchived } from "./masters-api";
import type { FieldSpec } from "./record-fields";
import { RecordMaster } from "./record-master";
import type { MoneyAccount } from "./types";

export const KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "overdraft", label: "Overdraft / cash credit" },
  { value: "cash", label: "Cash" },
];
const BANK_KINDS = { key: "kind", values: ["bank", "overdraft"] };

// Ledger names are kept as typed (same rule as the backend DTO).
const LEDGER_NAME = /^[A-Za-z0-9][A-Za-z0-9 &.,()/'-]{1,59}$/;
const LEDGER_NAME_MESSAGE = "2 to 60 letters, digits, spaces and & . , ( ) / ' -";

/** 1 April of the financial year a date falls in: the usual opening-balance date. */
export const yearStart = (isoDate: string) => `${financialYearOf(isoDate).slice(0, 4)}-04-01`;

/** The account's fields, shared with the "+" on the forms' account pickers (quick-add-money-account.tsx). */
export const BANK_CASH_FIELDS: FieldSpec[] = [
  { key: "name", label: "Account name", kind: "text", required: true, placeholder: "SBI current account", pattern: LEDGER_NAME, message: LEDGER_NAME_MESSAGE },
  { key: "kind", label: "Kind", kind: "select", required: true, options: KINDS },
  { key: "bankName", label: "Bank", kind: "text", required: true, maxLength: 80, placeholder: "State Bank of India", showWhen: BANK_KINDS },
  { key: "branch", label: "Branch", kind: "text", maxLength: 80, showWhen: BANK_KINDS },
  { key: "accountNumber", label: "Account number", kind: "text", required: true, pattern: /^\d{9,18}$/, message: "9 to 18 digits", showWhen: BANK_KINDS },
  { key: "ifsc", label: "IFSC", kind: "text", required: true, upperCase: true, pattern: /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, message: "4 letters, 0, then 6 letters or digits, like SBIN0001234", showWhen: BANK_KINDS },
  { key: "upiId", label: "UPI ID", kind: "text", placeholder: "mybusiness@sbi", pattern: /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$/, message: "Like mybusiness@sbi", showWhen: BANK_KINDS },
  { key: "openingBalance", label: "Opening balance (₹)", kind: "number", signed: true, hint: "Below zero only for an overdraft or cash credit: the amount drawn." },
  { key: "openingDate", label: "Balance as of", kind: "date", required: true },
  { key: "ledgerName", label: "Ledger name", kind: "text", pattern: LEDGER_NAME, message: LEDGER_NAME_MESSAGE, hint: "Leave blank to use the account name." },
  { key: "showOnInvoice", label: "Bank details on invoices", kind: "toggle", onLabel: "Print", offLabel: "Do not print", hint: "Only one account prints. Choosing this one replaces the current one.", wide: true, showWhen: BANK_KINDS },
  { key: "isDefault", label: "Default for receipts and payments", kind: "toggle", onLabel: "Default", offLabel: "Not default", hint: "Bank receipts and payments start on this account. Only one is the default; cash is always the one cash book.", wide: true, showWhen: BANK_KINDS },
];

/** A new account of a kind, its opening balance as of 1 April of this year. */
export const bankCashBlank = (today: string | null, kind: "bank" | "cash" = "bank") => ({
  kind,
  showOnInvoice: false,
  isDefault: false,
  openingBalance: 0,
  openingDate: today ? yearStart(today) : undefined,
});

// Bank, overdraft and cash books: each becomes a ledger. The balance
// today comes from the books: the opening plus receipts, vendor payments and
// loan entries through the account.
export function BankCashMaster() {
  const { data, error, mutate } = useSWR<BankCashAccountView[]>(withArchived(BANK_CASH_PATH), apiGet);
  const accounts = useMemo(() => data?.map(toMoneyAccount), [data]);
  const today = useToday();
  const balances = useSWR<BankCashBalanceView[]>(today ? booksPath("bank-cash-balances", today) : null, apiGet);
  const balanceOf = useMemo(() => new Map(balances.data?.map((row) => [row.accountId, row.balance])), [balances.data]);
  if (!accounts) return <LoadNotice error={error} what="bank and cash accounts" />;

  /** Today's balance from the books; the opening while it loads (or when this role cannot see the books). */
  const now = (account: MoneyAccount) => balanceOf.get(account.id) ?? account.openingBalance;
  const sum = (records: MoneyAccount[]) => records.reduce((total, account) => total + now(account), 0);
  const refresh = () => {
    void mutate();
    void balances.mutate();
  };
  return (
    <RecordMaster
      noun={["account", "bank and cash accounts"]}
      initialRecords={accounts}
      persist={bankCashPersistence(refresh)}
      nameKey="name"
      blank={bankCashBlank(today)}
      fields={BANK_CASH_FIELDS}
      columns={[
        {
          label: "Account",
          render: (account) => (
            <span>
              {account.name}
              <span className="block text-xs font-medium text-muted">{account.ledgerName ? `Ledger: ${account.ledgerName} · ` : ""}{account.accountGroup}</span>
            </span>
          ),
        },
        { label: "Bank", render: (account) => (account.kind === "cash" ? "Cash" : `${account.bankName ?? ""}${account.branch ? `, ${account.branch}` : ""}`) },
        { label: "Account no. · IFSC", render: (account) => (account.accountNumber ? `${account.accountNumber} · ${account.ifsc ?? ""}` : "–") },
        {
          label: "Opening balance",
          align: "right",
          render: (account) => (
            <span className={account.openingBalance < 0 ? "text-danger-strong" : undefined}>
              {formatRate(account.openingBalance)}
              <span className="block text-xs font-medium text-muted">
                {account.openingBalance < 0 ? "overdraft · " : ""}on {formatDate(account.openingDate)}
              </span>
            </span>
          ),
        },
        {
          label: "Balance today",
          align: "right",
          render: (account) => {
            const balance = balanceOf.get(account.id);
            if (balance === undefined) return <span className="text-muted">–</span>;
            return (
              <span className={balance < 0 ? "text-danger-strong" : undefined}>
                {formatRate(balance)}
                {balance < 0 && <span className="block text-xs font-medium text-muted">{account.kind === "overdraft" ? "overdraft drawn" : "below zero"}</span>}
              </span>
            );
          },
        },
        { label: "Invoices", render: (account) => (account.showOnInvoice ? <StatusChip tone="brand">Printed</StatusChip> : null) },
        {
          label: "Default",
          render: (account) =>
            account.kind === "cash" ? <StatusChip tone="neutral">Cash book</StatusChip> : account.isDefault ? <StatusChip tone="success">Default bank</StatusChip> : null,
        },
      ]}
      searchText={(account) => `${account.name} ${account.bankName ?? ""} ${account.accountNumber ?? ""} ${account.ifsc ?? ""} ${account.ledgerName ?? ""}`}
      filters={[
        { label: "Bank", test: (account) => account.kind === "bank" },
        { label: "Overdraft / CC", test: (account) => account.kind === "overdraft" },
        { label: "Cash", test: (account) => account.kind === "cash" },
      ]}
      stats={(records) => [
        { label: "Accounts", value: formatQuantity(records.length) },
        { label: "In bank today", value: formatInr(sum(records.filter((account) => account.kind === "bank"))) },
        { label: "Overdraft drawn", value: formatInr(Math.abs(sum(records.filter((account) => account.kind === "overdraft" && now(account) < 0)))), tone: "warning" },
        { label: "Cash today", value: formatInr(sum(records.filter((account) => account.kind === "cash"))) },
      ]}
      importMaster="bank-cash"
      footnote="Each account is a ledger under the group shown. The balance today is the opening plus every receipt, vendor payment and loan entry through it (cancelled ones left out)."
    />
  );
}
