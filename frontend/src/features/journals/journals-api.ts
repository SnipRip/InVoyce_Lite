// Journal voucher calls, and every ledger a journal line can name: general
// ledgers, expense and income heads, bank and cash accounts and (13 Nov 2026)
// customers and vendors, live only. A party line works on one side of their
// outstanding: it settles it or adds a charge (backend journal-rules.ts).
import useSWR from "swr";
import { LEDGERS_PATH } from "@/features/ledgers/ledgers-api";
import { ACCOUNT_HEADS_PATH, BANK_CASH_PATH } from "@/features/masters/masters-api";
import { apiGet, apiRequest } from "@/lib/api-client";
import type { AccountHeadView } from "@/types/account-head";
import type { BankCashAccountView } from "@/types/bank-cash";
import { PARTIES_PATH } from "@/features/parties/parties-api";
import type { JournalLedgerKind, JournalView, PartySideView } from "@/types/journal";
import type { PartyView } from "@/types/party";
import type { LedgerView } from "@/types/ledger";

export const JOURNALS_PATH = "/journals";

/** One pickable ledger; `value` is "kind:id" so the three masters never clash. */
export interface JournalLedgerOption {
  value: string;
  kind: JournalLedgerKind;
  id: string;
  label: string;
  group: string;
  isMoney: boolean;
  /** A cash book, for the cash limits (s.269ST, s.40A(3)). */
  isCash?: boolean;
  /** Party lines: the roles, to know the side (asked only when both). */
  isCustomer?: boolean;
  isVendor?: boolean;
}

/** The side a party line works on: the one picked, else the party's only role; null when it must be picked. */
export function sideOf(option: JournalLedgerOption, picked: string): PartySideView | null {
  if (picked === "RECEIVABLE" || picked === "PAYABLE") return picked;
  if (option.isCustomer && option.isVendor) return null;
  return option.isCustomer ? "RECEIVABLE" : "PAYABLE";
}

/** True when a party line settles what is outstanding on its side; false when it adds a charge. */
export const settlesOutstanding = (side: PartySideView, line: { debit: number; credit: number }) => (side === "RECEIVABLE" ? line.credit > 0 : line.debit > 0);

/**
 * Cash on a voucher, as backend journal-rules.ts `cashByParty` counts it:
 * the cash lines' net in or out, taken by each party line on the other side
 * up to its amount. `paidOther` is cash out against heads and ledgers.
 */
export function cashFlowsOf(lines: { option: JournalLedgerOption | undefined; debit: number; credit: number }[]) {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const net = round2(lines.filter((line) => line.option?.isCash).reduce((sum, line) => sum + line.debit - line.credit, 0));
  const parties: { label: string; received: number; paid: number }[] = [];
  let otherDebits = 0;
  for (const line of lines) {
    if (!line.option) continue;
    if (line.option.kind === "party") {
      const received = net > 0 ? Math.min(line.credit, net) : 0;
      const paid = net < 0 ? Math.min(line.debit, -net) : 0;
      if (received > 0 || paid > 0) parties.push({ label: line.option.label, received: round2(received), paid: round2(paid) });
    } else if (!line.option.isMoney) otherDebits += line.debit;
  }
  return { parties, paidOther: net < 0 ? round2(Math.min(otherDebits, -net)) : 0 };
}

export const optionValue = (kind: JournalLedgerKind, id: string) => `${kind}:${id}`;

export function useJournalLedgers() {
  const ledgers = useSWR<LedgerView[]>(LEDGERS_PATH, apiGet);
  const heads = useSWR<AccountHeadView[]>(ACCOUNT_HEADS_PATH, apiGet);
  const accounts = useSWR<BankCashAccountView[]>(BANK_CASH_PATH, apiGet);
  const parties = useSWR<PartyView[]>(PARTIES_PATH, apiGet);
  const error = ledgers.error ?? heads.error ?? accounts.error ?? parties.error;
  if (!ledgers.data || !heads.data || !accounts.data || !parties.data) return { options: undefined, error };
  const options: JournalLedgerOption[] = [
    // The Profit & Loss A/c (no group) is closed by the books, never by hand.
    ...ledgers.data
      .filter((ledger) => !ledger.isArchived && ledger.groupId)
      .map((ledger) => ({ value: optionValue("ledger", ledger.id), kind: "ledger" as const, id: ledger.id, label: ledger.name, group: ledger.groupName ?? "", isMoney: false })),
    ...heads.data
      .filter((head) => !head.isArchived)
      .map((head) => ({ value: optionValue("head", head.id), kind: "head" as const, id: head.id, label: head.name, group: head.accountGroup, isMoney: false })),
    ...accounts.data
      .filter((account) => !account.isArchived)
      .map((account) => ({
        value: optionValue("account", account.id),
        kind: "account" as const,
        id: account.id,
        label: account.ledgerName ?? account.name,
        group: account.accountGroup,
        isMoney: true,
        isCash: account.kind === "CASH",
      })),
    ...parties.data
      .filter((party) => !party.isArchived)
      .map((party) => ({
        value: optionValue("party", party.id),
        kind: "party" as const,
        id: party.id,
        label: party.displayName,
        group: party.isCustomer && party.isVendor ? "Customer and vendor" : party.isCustomer ? "Customer" : "Vendor",
        isMoney: false,
        isCustomer: party.isCustomer,
        isVendor: party.isVendor,
      })),
  ].sort((a, b) => a.label.localeCompare(b.label));
  return { options, error };
}

export interface JournalBody {
  date: string;
  number: string | null;
  narration: string | null;
  lines: {
    kind: JournalLedgerKind;
    id: string;
    debit: number;
    credit: number;
    partySide?: PartySideView | null;
    against?: { kind: "INVOICE" | "BILL" | "EXPENSE" | "OPENING" | "JOURNAL"; documentId: string } | null;
  }[];
}

export const createJournal = (body: JournalBody) => apiRequest<JournalView>(JOURNALS_PATH, { method: "POST", body });

export const cancelJournal = (id: string, reason: string) => apiRequest<JournalView>(`${JOURNALS_PATH}/${id}/cancel`, { method: "POST", body: { reason } });

/** A settling customer / vendor line's credit applied to their open documents. */
export const applyJournalCredit = (journalId: string, lineId: string, allocations: { kind: string; documentId: string; amount: number }[]) =>
  apiRequest<JournalView>(`${JOURNALS_PATH}/${journalId}/lines/${lineId}/allocations`, { method: "POST", body: { allocations } });

export const journalPreviewPath = (date: string) => `/number-series/preview?kind=JOURNAL&date=${date}`;
