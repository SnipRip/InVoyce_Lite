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
import { StatusChip } from "@/components/ui/status-chip";
import { formatDayMonth, formatRate } from "@/lib/format";
import type { JournalView } from "@/types/journal";

type Filter = "live" | "cancelled" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "live", label: "In the books" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

/** "Rent and others" style: the first ledger on a side and how many more. */
const sideText = (journal: JournalView, side: "debit" | "credit") => {
  const names = journal.lines.filter((line) => line[side] > 0).map((line) => line.ledger);
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] ?? "");
};

// Every journal voucher, newest first.
export function JournalsWorkspace({ journals }: { journals: JournalView[] }) {
  const [filter, setFilter] = useState<Filter>("live");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = journals.filter(
    (journal) =>
      (filter === "all" || (filter === "cancelled") === Boolean(journal.cancelledAt)) &&
      (!needle || `${journal.number} ${journal.narration ?? ""} ${journal.lines.map((line) => line.ledger).join(" ")}`.toLowerCase().includes(needle)),
  );

  return (
    <GlassCard className="flex flex-col gap-3.5">
      <ListToolbar
        actions={
          <Link href="/journals/new" className={buttonClasses("primary", undefined, "lg")}>
            <Plus aria-hidden="true" />
            New journal
          </Link>
        }
      >
        <SearchField
          className="max-w-[340px] flex-[1_1_240px]"
          id="journal-search"
          label="Search journals"
          value={query}
          onChange={setQuery}
          placeholder="Number, ledger or narration"
          trailing={`${visible.length} of ${journals.length}`}
        />
        <FilterGroup label="Show">
          {FILTERS.map((option) => (
            <FilterChip key={option.value} selected={filter === option.value} onClick={() => setFilter(option.value)}>
              {option.label}
            </FilterChip>
          ))}
        </FilterGroup>
      </ListToolbar>
      <GlassTable className="min-w-[720px]">
        <thead>
          <tr>
            <th scope="col" className="text-left">Journal</th>
            <th scope="col" className="text-left">Debited</th>
            <th scope="col" className="text-left">Credited</th>
            <th scope="col" className="text-right">Amount</th>
            <th scope="col" className="text-left">Type</th>
          </tr>
        </thead>
        <tbody className="font-semibold tabular-nums">
          {visible.map((journal) => (
            <tr key={journal.id} className="align-top">
              <td>
                <Link href={`/journals/${journal.id}`} className="hover:text-brand hover:underline">
                  {journal.number}
                </Link>
                <div className="text-xs text-muted">{formatDayMonth(journal.date)}</div>
              </td>
              <td>
                {sideText(journal, "debit")}
                {journal.narration && <div className="max-w-[280px] truncate text-xs font-medium text-muted">{journal.narration}</div>}
              </td>
              <td>{sideText(journal, "credit")}</td>
              <td className="text-right">{formatRate(journal.total)}</td>
              <td>{journal.cancelledAt ? <StatusChip tone="danger">Cancelled</StatusChip> : <StatusChip tone="neutral">{journal.type}</StatusChip>}</td>
            </tr>
          ))}
        </tbody>
      </GlassTable>
      {visible.length === 0 && (
        <p className="py-6 text-center text-[13px] text-muted">{journals.length ? "No journals match." : "No journal entries yet. Depreciation, provisions and corrections go here."}</p>
      )}
    </GlassCard>
  );
}
