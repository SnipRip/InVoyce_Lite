"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { SearchField } from "@/components/ui/search-field";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDayMonth, formatInr, formatQuantity, formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { CreditNoteView, DebitNoteView } from "@/types/note";
import { NOTE_TEXT, reasonLabel, type NoteKind } from "./notes-api";

type Note = CreditNoteView | DebitNoteView;
const documentOf = (note: Note) => ("invoiceNumber" in note ? { id: note.invoiceId, label: note.invoiceNumber, href: `/invoices/${note.invoiceId}` } : { id: note.billId, label: note.billReference, href: `/purchases/${note.billId}` });

// Every credit note (or debit note), newest first.
export function NotesWorkspace({ kind, notes }: { kind: NoteKind; notes: Note[] }) {
  const text = NOTE_TEXT[kind];
  const [showCancelled, setShowCancelled] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = notes.filter(
    (note) =>
      Boolean(note.cancelledAt) === showCancelled &&
      (!needle || `${note.number} ${note.partyName} ${documentOf(note).label} ${note.lines.map((line) => line.itemName).join(" ")}`.toLowerCase().includes(needle)),
  );
  const month = useToday()?.slice(0, 7) ?? "";
  const thisMonth = notes.filter((note) => !note.cancelledAt && note.date.startsWith(month));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
        <StatTile label={`${text.plural} this month`} value={formatQuantity(thisMonth.length)} />
        <StatTile label="Value this month" value={formatInr(thisMonth.reduce((sum, note) => sum + note.total, 0))} />
        <StatTile label="GST this month" value={formatInr(thisMonth.reduce((sum, note) => sum + note.tax, 0))} />
      </div>
      <GlassCard className="flex flex-col gap-3.5">
        <ListToolbar
          actions={
            <Link href={`${text.path}/new`} className={buttonClasses("primary", undefined, "lg")}>
              <Plus aria-hidden="true" />
              New {text.title.toLowerCase()}
            </Link>
          }
        >
          <SearchField
            className="max-w-[340px] flex-[1_1_240px]"
            id={`${kind}-note-search`}
            label={`Search ${text.plural.toLowerCase()}`}
            value={query}
            onChange={setQuery}
            placeholder={`Number, ${text.party.toLowerCase()}, ${text.against} or item`}
            trailing={`${visible.length} of ${notes.length}`}
          />
          <FilterGroup label="Show">
            <FilterChip selected={!showCancelled} onClick={() => setShowCancelled(false)}>
              In the books
            </FilterChip>
            <FilterChip selected={showCancelled} onClick={() => setShowCancelled(true)}>
              Cancelled
            </FilterChip>
          </FilterGroup>
        </ListToolbar>
        <GlassTable className="min-w-[760px]">
          <thead>
            <tr>
              <th scope="col" className="text-left">{text.title}</th>
              <th scope="col" className="text-left">{text.party}</th>
              <th scope="col" className="text-left">Against</th>
              <th scope="col" className="text-left">Why</th>
              <th scope="col" className="text-right">GST</th>
              <th scope="col" className="text-right">Total</th>
            </tr>
          </thead>
          <tbody className="font-semibold tabular-nums">
            {visible.map((note) => {
              const document = documentOf(note);
              return (
                <tr key={note.id} className="align-top">
                  <td>
                    <Link href={`${text.path}/${note.id}`} className="hover:text-brand hover:underline">
                      {note.number}
                    </Link>
                    <div className="text-xs text-muted">{formatDayMonth(note.date)}</div>
                  </td>
                  <td>{note.partyName}</td>
                  <td>
                    <Link href={document.href} className="hover:text-brand hover:underline">
                      {document.label}
                    </Link>
                  </td>
                  <td>
                    {reasonLabel(note.reason)}
                    {note.cancelledAt && (
                      <div>
                        <StatusChip tone="danger">Cancelled</StatusChip>
                      </div>
                    )}
                  </td>
                  <td className="text-right">{formatRate(note.tax)}</td>
                  <td className="text-right">{formatRate(note.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </GlassTable>
        {visible.length === 0 && (
          <p className="py-6 text-center text-[13px] text-muted">
            {notes.length ? "No notes match." : `No ${text.plural.toLowerCase()} yet. Issue one from here or from the ${text.against}'s page.`}
          </p>
        )}
      </GlassCard>
    </div>
  );
}
