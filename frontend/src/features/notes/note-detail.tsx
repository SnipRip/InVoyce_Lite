"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { CancelDocument } from "@/components/ui/cancel-document";
import { FactTile } from "@/components/ui/fact-tile";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import type { Issuer } from "@/features/invoices/invoice-document";
import type { Party } from "@/features/parties/types";
import type { CreditNoteView, DebitNoteView } from "@/types/note";
import { NoteCreditCard } from "./note-credit-card";
import { NoteDocument } from "./note-document";
import { cancelNote, NOTE_TEXT, reasonLabel, type NoteKind } from "./notes-api";

// One credit or debit note: its document, lines, GST, what cancelling does,
// and the printed note (party and our company for its particulars).
interface NoteDetailProps {
  kind: NoteKind;
  note: CreditNoteView | DebitNoteView;
  party: Party | undefined;
  issuer: Issuer;
  onChanged: () => Promise<void>;
}

export function NoteDetail({ kind, note, party, issuer, onChanged }: NoteDetailProps) {
  const text = NOTE_TEXT[kind];
  const credit = "invoiceNumber" in note ? note : null;
  const debit = "billReference" in note ? note : null;
  const goods = note.reason === "GOODS_RETURNED";
  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <GlassCard className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{note.number}</CardTitle>
            <StatusChip tone={note.cancelledAt ? "danger" : "neutral"}>{note.cancelledAt ? "Cancelled" : reasonLabel(note.reason)}</StatusChip>
            {!note.gstAdjusted && <StatusChip tone="warning">Without GST</StatusChip>}
            <Link href={text.path} className={buttonClasses("neutral", "ml-auto")}>
              Back to {text.plural.toLowerCase()}
            </Link>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-4">
            <FactTile label="Date">{formatDate(note.date)}</FactTile>
            <FactTile label={text.party}>{note.partyName}</FactTile>
            <FactTile label="Against">
              {credit && (
                <Link href={`/invoices/${credit.invoiceId}`} className="hover:text-brand hover:underline">
                  {credit.invoiceNumber} of {formatDate(credit.invoiceDate)}
                </Link>
              )}
              {debit && (
                <Link href={`/purchases/${debit.billId}`} className="hover:text-brand hover:underline">
                  {debit.billReference} ({debit.vendorBillNumber})
                </Link>
              )}
            </FactTile>
            {credit?.godownName && <FactTile label="Goods back into">{credit.godownName}</FactTile>}
          </dl>
          {note.notes && <p className="text-sm font-medium text-ink-soft">{note.notes}</p>}
        </GlassCard>
        <NoteCreditCard kind={kind} note={note} onChanged={onChanged} />
        <GlassCard className="flex flex-col gap-3">
          <CardTitle>Lines</CardTitle>
          <GlassTable className="min-w-[640px]">
            <thead>
              <tr className="text-right">
                <th scope="col" className="text-left">Item</th>
                {goods && <th scope="col">Quantity</th>}
                <th scope="col">Value</th>
                <th scope="col">GST</th>
                {goods && <th scope="col">Stock cost</th>}
              </tr>
            </thead>
            <tbody className="text-right font-semibold tabular-nums">
              {note.lines.map((line) => (
                <tr key={line.id}>
                  <td className="text-left">
                    <Link href={`/items/${line.itemId}`} className="hover:text-brand hover:underline">
                      {line.itemName}
                    </Link>
                    <div className="text-xs font-medium text-muted">{note.gstAdjusted ? `GST ${line.gstRatePct}%` : "No GST on this note"}</div>
                  </td>
                  {goods && (
                    <td>
                      {formatQuantity(line.quantity)} {line.unit}
                    </td>
                  )}
                  <td>{formatRate(line.taxable)}</td>
                  <td>{formatRate(line.tax)}</td>
                  {goods && <td>{formatRate(line.cost)}</td>}
                </tr>
              ))}
            </tbody>
          </GlassTable>
        </GlassCard>
        <NoteDocument kind={kind} note={note} party={party} issuer={issuer} />
      </div>
      <GlassCard className="flex flex-col gap-3 xl:sticky xl:top-3.5">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <FactTile label="Value">{formatRate(note.taxable)}</FactTile>
          <FactTile label={note.igst ? "IGST" : "CGST + SGST"}>{formatRate(note.tax)}</FactTile>
          {debit && <FactTile label="Input credit given back">{formatRate(debit.itcReversed)}</FactTile>}
          <FactTile label="Round off">{formatRate(note.roundOff)}</FactTile>
          <FactTile label="Total">
            <span className="text-[15px]">{formatRate(note.total)}</span>
          </FactTile>
          {!note.cancelledAt && note.creditLeft > 0 && <FactTile label="Credit left">{formatRate(note.creditLeft)}</FactTile>}
          <FactTile label="Entered by">{note.createdBy ?? "–"}</FactTile>
        </dl>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-[18px]" />
          Print {text.title.toLowerCase()} or save as PDF
        </Button>
        {note.cancelledAt ? (
          <p className="text-sm font-semibold text-danger-strong">
            Cancelled {formatDate(note.cancelledAt.slice(0, 10))}: {note.cancelReason}. It no longer counts.
          </p>
        ) : (
          <CancelDocument
            noun={text.title.toLowerCase()}
            effect={`It stops counting against the ${text.against} and in the books${goods ? (kind === "credit" ? "; the goods it brought back leave stock again" : "; the goods it sent back return to stock") : ""}. The number is cancelled for good.`}
            blocked={credit?.usedSince ? "Some of the goods it brought back have been sold or moved since, so it cannot be cancelled." : undefined}
            onCancel={async (reason) => {
              await cancelNote(kind, note.id, reason);
              await onChanged();
            }}
          />
        )}
      </GlassCard>
    </div>
  );
}
