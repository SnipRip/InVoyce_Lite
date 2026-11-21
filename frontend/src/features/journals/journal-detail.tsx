"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { CancelDocument } from "@/components/ui/cancel-document";
import { FactTile } from "@/components/ui/fact-tile";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatRate } from "@/lib/format";
import type { JournalLineView, JournalView } from "@/types/journal";
import { ApplyCreditForm } from "@/features/payments/apply-credit-form";
import { documentHref } from "@/features/payments/settlements-api";
import { applyJournalCredit, cancelJournal } from "./journals-api";

const statementHref = (ledger: string) => `/financial-statements?view=ledger&ledger=${encodeURIComponent(ledger)}`;

// One journal voucher: its lines as the books take them, each ledger linking
// to its statement.
export function JournalDetail({ journal, onChanged }: { journal: JournalView; onChanged: () => Promise<void> }) {
  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <GlassCard className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{journal.number}</CardTitle>
            <StatusChip tone={journal.cancelledAt ? "danger" : "neutral"}>{journal.cancelledAt ? "Cancelled" : journal.type}</StatusChip>
            <Link href="/journals" className={buttonClasses("neutral", "ml-auto")}>
              Back to journals
            </Link>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <FactTile label="Date">{formatDate(journal.date)}</FactTile>
            <FactTile label="Amount">{formatRate(journal.total)}</FactTile>
            <FactTile label="Entered by">{journal.createdBy ?? "–"}</FactTile>
          </dl>
          {journal.narration && <p className="text-sm font-medium text-ink-soft">{journal.narration}</p>}
        </GlassCard>
        <GlassCard className="flex flex-col gap-3">
          <CardTitle>Debit and credit</CardTitle>
          <GlassTable className="min-w-[560px]">
            <thead>
              <tr>
                <th scope="col" className="text-left">Ledger</th>
                <th scope="col" className="text-right">Debit ₹</th>
                <th scope="col" className="text-right">Credit ₹</th>
              </tr>
            </thead>
            <tbody className="font-semibold tabular-nums">
              {journal.lines.map((line) => (
                <tr key={line.lineId}>
                  <td>
                    <Link href={statementHref(line.ledger)} className="hover:text-brand hover:underline">
                      {line.credit > 0 ? `To ${line.ledger}` : line.ledger}
                    </Link>
                    <div className="text-xs font-medium text-muted">
                      {line.group}
                      {line.partySide && ` · ${line.settles ? "settles" : "adds to"} what ${line.partySide === "RECEIVABLE" ? "they owe us" : "we owe them"}`}
                    </div>
                  </td>
                  <td className="text-right">{line.debit ? formatRate(line.debit) : ""}</td>
                  <td className="text-right">{line.credit ? formatRate(line.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t border-line font-semibold">
                <td>Total</td>
                <td className="text-right">{formatRate(journal.total)}</td>
                <td className="text-right">{formatRate(journal.total)}</td>
              </tr>
            </tfoot>
          </GlassTable>
        </GlassCard>
        {journal.lines
          .filter((line) => line.partySide)
          .map((line) => (
            <JournalPartyCard key={line.lineId} journal={journal} line={line} onChanged={onChanged} />
          ))}
      </div>
      <GlassCard className="flex flex-col gap-3 xl:sticky xl:top-3.5">
        {journal.cancelledAt ? (
          <p className="text-sm font-semibold text-danger-strong">
            Cancelled {formatDate(journal.cancelledAt.slice(0, 10))}: {journal.cancelReason}. It no longer counts in the books.
          </p>
        ) : (
          <CancelDocument
            noun="journal"
            effect="It stops counting in the books and its number is cancelled for good; what its customer or vendor lines settled opens again. Enter a new journal if it was wrong."
            onCancel={async (reason) => {
              await cancelJournal(journal.id, reason);
              await onChanged();
            }}
          />
        )}
      </GlassCard>
    </div>
  );
}

/** A customer or vendor line: what it settled and the credit left, or the charge it added and what is still open. */
function JournalPartyCard({ journal, line, onChanged }: { journal: JournalView; line: JournalLineView; onChanged: () => Promise<void> }) {
  const live = !journal.cancelledAt;
  const receivable = line.partySide === "RECEIVABLE";
  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>{line.ledger}</CardTitle>
        <StatusChip tone="neutral">{line.settles ? "Settles" : "Charge"}</StatusChip>
        {live && line.settles && line.creditLeft > 0 && <span className="ml-auto text-sm font-semibold text-brand-strong">{formatRate(line.creditLeft)} is their credit</span>}
        {live && !line.settles && (
          <span className="ml-auto text-sm font-semibold">
            {line.balance > 0 ? `${formatRate(line.balance)} open of ${formatRate(line.debit || line.credit)}` : "Settled"}
          </span>
        )}
      </div>
      {line.settles ? (
        <>
          {line.applied.length ? (
            <ul className="flex flex-col gap-1 text-sm font-semibold">
              {line.applied.map((row) => (
                <li key={`${row.documentId}-${row.appliedAt}`} className="flex justify-between gap-3 tabular-nums">
                  <Link href={documentHref({ kind: row.kind, id: row.documentId, partyId: line.id, journalId: row.journalId })} className="hover:text-brand hover:underline">
                    {row.number}
                  </Link>
                  <span>{formatRate(row.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-medium text-muted">Not set against a document yet.</p>
          )}
          {live && line.creditLeft > 0 && (
            <ApplyCreditForm
              direction={receivable ? "RECEIPT" : "PAYMENT"}
              partyId={line.id}
              partyName={line.ledger}
              creditLeft={line.creditLeft}
              sourceId={line.lineId}
              apply={(allocations) => applyJournalCredit(journal.id, line.lineId, allocations)}
              onChanged={onChanged}
            />
          )}
        </>
      ) : (
        live &&
        line.balance > 0 && (
          <p className="text-sm font-medium text-muted">
            It is open in {receivable ? "what they owe us" : "what we owe them"} like a document.{" "}
            <Link href={`${receivable ? "/payments/receipts/new" : "/payments/vendor-payments/new"}?document=${line.lineId}`} className="font-semibold text-brand hover:underline">
              {receivable ? "Record a receipt" : "Record a payment"}
            </Link>
          </p>
        )
      )}
    </GlassCard>
  );
}
