"use client";

import { useToday } from "@/lib/use-today";
import type { BankCashAccountView } from "@/types/bank-cash";
import { BANK_CASH_FIELDS, bankCashBlank, KINDS } from "./bank-cash-master";
import { BANK_CASH_PATH, bankCashPersistence } from "./masters-api";
import { useQuickAddRecord } from "./quick-add-record";

// The "+" beside the bank / cash account picker on receipts, payments,
// refunds and expenses (client, 12 Nov 2026). The master's own fields, the
// kinds narrowed to what the payment mode goes through: a bank transfer,
// cheque or UPI to a bank or overdraft account; cash to the cash book, and
// only while there is none (cash is one fixed account; the backend refuses a
// second). `canAdd` is false when nothing can be added for the mode.
export function useQuickAddMoneyAccount({ mode, accounts, onPick }: { mode: string; accounts: BankCashAccountView[]; onPick: (id: string) => void }) {
  const today = useToday();
  const cash = mode === "CASH";
  const kinds = KINDS.filter((kind) => (kind.value === "cash") === cash);
  const quickAdd = useQuickAddRecord({
    title: cash ? "New cash book" : "New bank account",
    fields: BANK_CASH_FIELDS.map((field) => (field.key === "kind" ? { ...field, options: kinds } : field)),
    blank: bankCashBlank(today, cash ? "cash" : "bank"),
    persistence: bankCashPersistence(() => {}),
    path: BANK_CASH_PATH,
    listedIds: accounts.map((account) => account.id),
    onPick,
  });
  const canAdd = !cash || !accounts.some((account) => account.kind === "CASH" && !account.isArchived);
  return { ...quickAdd, canAdd, label: cash ? "Add the cash book" : "Add a new bank account" };
}
