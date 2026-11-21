"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ComboField } from "@/components/ui/combo-field";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { LoadNotice } from "@/components/ui/load-notice";
import { StatTile } from "@/components/ui/stat-tile";
import { TextField } from "@/components/ui/text-field";
import { apiGet } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { financialYearOf } from "@/lib/financial-year";
import type { BookLedgerView, LedgerStatementView } from "@/types/ledger";
import { CASH_GROUPS, drCr, figure, ledgerStatementPath, ledgersPath, voucherHref } from "./books-api";

export type StatementMode = "ledger" | "cash" | "bank";

const TITLES: Record<StatementMode, string> = { ledger: "Ledger statement", cash: "Cash book", bank: "Bank book" };
const PICK_LABEL: Record<StatementMode, string> = { ledger: "Ledger", cash: "Cash account", bank: "Bank account" };

/** The ledgers each mode offers: any ledger, cash accounts, or bank and overdraft accounts. */
function choices(ledgers: BookLedgerView[], mode: StatementMode) {
  const isCash = (ledger: BookLedgerView) => ledger.source === "bankCash" && CASH_GROUPS.includes(ledger.group ?? "");
  if (mode === "cash") return ledgers.filter(isCash);
  if (mode === "bank") return ledgers.filter((ledger) => ledger.source === "bankCash" && !isCash(ledger));
  return ledgers;
}

// A ledger's vouchers between two dates with the ledger on the other side and
// a running balance; the cash book and bank book are the same view held to
// cash or bank accounts (client, 12 Nov 2026). Rows link to their voucher.
export function LedgerStatementPanel({ mode, today, initialLedger }: { mode: StatementMode; today: string; initialLedger?: string }) {
  const [from, setFrom] = useState(`${financialYearOf(today).slice(0, 4)}-04-01`);
  const [to, setTo] = useState(today);
  const [picked, setPicked] = useState(initialLedger ?? "");
  const ledgers = useSWR<BookLedgerView[]>(ledgersPath(to || today), apiGet, { keepPreviousData: true });
  const offered = ledgers.data ? choices(ledgers.data, mode) : [];
  // The cash and bank books open on the first account; a ledger statement waits for a pick.
  const ledger = picked || (mode === "ledger" ? "" : (offered[0]?.name ?? ""));
  const ready = Boolean(ledger && from && to && from <= to);
  const statement = useSWR<LedgerStatementView>(ready ? ledgerStatementPath(ledger, from, to) : null, apiGet);

  return (
    <div className="flex flex-col gap-3.5">
      <ListToolbar
        actions={
          <>
            <TextField label="From" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            <TextField label="To" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </>
        }
      >
        <ComboField
          label={PICK_LABEL[mode]}
          className="min-w-[260px] flex-1"
          options={offered.map((option) => ({ value: option.name, label: option.name, detail: option.group ?? "Primary" }))}
          value={ledger}
          onChange={setPicked}
          placeholder={mode === "ledger" ? "Type a ledger, party or head" : "Pick the account"}
        />
      </ListToolbar>

      {!ledgers.data && <LoadNotice error={ledgers.error} what="the ledgers" />}
      {ledgers.data && offered.length === 0 && mode !== "ledger" && (
        <GlassCard>
          <p className="text-sm font-medium text-muted">
            No {mode === "cash" ? "cash" : "bank"} account yet. Add one under Masters, Bank &amp; cash.
          </p>
        </GlassCard>
      )}
      {ledgers.data && !ledger && mode === "ledger" && (
        <GlassCard>
          <p className="text-sm font-medium text-muted">Pick a ledger to see every entry through it.</p>
        </GlassCard>
      )}
      {from > to && <p className="text-sm font-semibold text-danger-strong">The first day is after the last day.</p>}
      {ready && !statement.data && <LoadNotice error={statement.error} what="the statement" />}
      {ready && statement.data && <StatementTable mode={mode} statement={statement.data} />}
    </div>
  );
}

function StatementTable({ mode, statement }: { mode: StatementMode; statement: LedgerStatementView }) {
  const money = mode !== "ledger";
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Opening" value={drCr(statement.opening)} />
        <StatTile label={money ? "Received (Dr)" : "Debits"} value={figure(statement.totalDebit) || "–"} />
        <StatTile label={money ? "Paid (Cr)" : "Credits"} value={figure(statement.totalCredit) || "–"} />
        <StatTile label="Closing" value={drCr(statement.closing)} tone={money && statement.closing < 0 ? "danger" : undefined} />
      </div>
      <GlassCard className="flex flex-col gap-3">
        <CardTitle>
          {TITLES[mode]}: {statement.ledger}
          <span className="ml-2 text-xs font-medium text-muted">
            {statement.group ?? "Primary"} · {formatDate(statement.from)} to {formatDate(statement.to)}
          </span>
        </CardTitle>
        <GlassTable className="min-w-[760px]">
          <thead>
            <tr>
              <th scope="col" className="text-left">Date</th>
              <th scope="col" className="text-left">Particulars</th>
              <th scope="col" className="text-left">Voucher</th>
              <th scope="col" className="text-right">Debit ₹</th>
              <th scope="col" className="text-right">Credit ₹</th>
              <th scope="col" className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="bg-ink/[0.025]">
              <td>{formatDate(statement.from)}</td>
              <td className="font-semibold" colSpan={4}>
                Opening balance
              </td>
              <td className="text-right font-semibold">{drCr(statement.opening)}</td>
            </tr>
            {statement.rows.map((row, index) => {
              const href = voucherHref(row.source, row.sourceId);
              return (
                <tr key={`${row.source}-${row.sourceId}-${index}`}>
                  <td className="whitespace-nowrap">{formatDate(row.date)}</td>
                  <td>
                    <span className="font-semibold">{row.particulars}</span>
                    {row.narration && <div className="max-w-[360px] truncate text-xs text-muted">{row.narration}</div>}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="text-xs text-muted">{row.type}</span>
                    <div>
                      {href ? (
                        <Link href={href} className="font-medium hover:text-brand hover:underline">
                          {row.number ?? "Open"}
                        </Link>
                      ) : (
                        (row.number ?? "")
                      )}
                    </div>
                  </td>
                  <td className="text-right">{figure(row.debit)}</td>
                  <td className="text-right">{figure(row.credit)}</td>
                  <td className={clsx("text-right font-medium", money && row.balance < 0 && "text-danger-strong")}>{drCr(row.balance)}</td>
                </tr>
              );
            })}
            {statement.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-sm font-medium text-muted">
                  Nothing went through this ledger in these dates.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-t border-line font-semibold">
              <td colSpan={3}>Closing balance</td>
              <td className="text-right">{figure(statement.totalDebit)}</td>
              <td className="text-right">{figure(statement.totalCredit)}</td>
              <td className="text-right">{drCr(statement.closing)}</td>
            </tr>
          </tfoot>
        </GlassTable>
        {money && statement.closing < 0 && (
          <p className="text-xs font-semibold text-danger-strong">
            {mode === "cash" ? "Cash cannot run below zero: an entry is missing or dated wrong." : "Below zero: overdraft in use."}
          </p>
        )}
      </GlassCard>
    </>
  );
}
