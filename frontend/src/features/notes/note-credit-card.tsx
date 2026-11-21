"use client";

import Link from "next/link";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { apiRequest } from "@/lib/api-client";
import { formatDate, formatInr } from "@/lib/format";
import type { CreditNoteView, DebitNoteView } from "@/types/note";
import { ApplyCreditForm } from "@/features/payments/apply-credit-form";
import { documentHref, refundPath } from "@/features/payments/settlements-api";
import { NOTE_TEXT, type NoteKind } from "./notes-api";

// What a note settled and what it still holds as the party's credit (client,
// 13 Nov 2026): a note bigger than what its document still owed (goods back
// after it was paid) leaves the rest as credit, applied here to the party's
// other open documents or refunded (Payments → Refund).
export function NoteCreditCard({ kind, note, onChanged }: { kind: NoteKind; note: CreditNoteView | DebitNoteView; onChanged: () => Promise<void> }) {
  const text = NOTE_TEXT[kind];
  const live = !note.cancelledAt;
  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>What it settles</CardTitle>
        {live && note.creditLeft > 0 && (
          <span className="ml-auto text-sm font-semibold text-brand-strong">
            {formatInr(note.creditLeft)} is {kind === "credit" ? "the customer’s" : "our"} credit
          </span>
        )}
      </div>
      <GlassTable className="min-w-[420px]">
        <thead>
          <tr className="text-right">
            <th scope="col" className="text-left">Against</th>
            <th scope="col" className="text-left">On</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody className="text-right font-semibold tabular-nums">
          {note.settles.map((row) => (
            <tr key={`${row.kind}-${row.documentId}-${row.appliedAt}`}>
              <td className="text-left">
                <Link href={documentHref({ kind: row.kind, id: row.documentId, partyId: note.partyId, journalId: row.journalId })} className="hover:text-brand hover:underline">
                  {row.number}
                </Link>
              </td>
              <td className="text-left">{formatDate(row.appliedAt.slice(0, 10))}</td>
              <td>{formatInr(row.amount)}</td>
            </tr>
          ))}
          {note.refunds.map((refund) => (
            <tr key={refund.id}>
              <td className="text-left">
                <Link href={`/payments/entries/${refund.id}`} className="hover:text-brand hover:underline">
                  Refund {refund.number}
                </Link>
              </td>
              <td className="text-left">{formatDate(refund.date)}</td>
              <td>{formatInr(refund.amount)}</td>
            </tr>
          ))}
          {note.settles.length === 0 && note.refunds.length === 0 && (
            <tr>
              <td colSpan={3} className="text-left font-medium text-muted">
                Nothing yet: the {text.against} was already settled when this note was made.
              </td>
            </tr>
          )}
        </tbody>
      </GlassTable>
      {live && note.creditLeft > 0 && (
        <ApplyCreditForm
          direction={kind === "credit" ? "RECEIPT" : "PAYMENT"}
          partyId={note.partyId}
          partyName={note.partyName}
          creditLeft={note.creditLeft}
          apply={(allocations) => apiRequest(`${text.path}/${note.id}/allocations`, { method: "POST", body: { allocations } })}
          onChanged={onChanged}
          refund={{ href: refundPath(note.id), label: kind === "credit" ? "Pay it back" : "Receive it back" }}
        />
      )}
    </GlassCard>
  );
}
