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
import { formatDayMonth, formatInr, formatQuantity } from "@/lib/format";
import type { ChallanStatusView, ChallanView } from "@/types/challan";
import { STATUS_TEXT } from "./challans-api";

const FILTERS: { value: ChallanStatusView | "ALL"; label: string }[] = [
  { value: "OPEN", label: "Not invoiced" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
];

// Every delivery challan, newest first; the ones not yet invoiced come first in the filter.
export function ChallansWorkspace({ challans }: { challans: ChallanView[] }) {
  const [filter, setFilter] = useState<ChallanStatusView | "ALL">("OPEN");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = challans.filter(
    (challan) =>
      (filter === "ALL" || challan.status === filter) &&
      (!needle || `${challan.number} ${challan.partyName} ${challan.vehicleNumber ?? ""} ${challan.lines.map((line) => line.itemName).join(" ")}`.toLowerCase().includes(needle)),
  );
  const open = challans.filter((challan) => challan.status === "OPEN");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
        <StatTile label="Sent, not invoiced" value={formatQuantity(open.length)} tone={open.length ? "warning" : undefined} />
        <StatTile label="Their value" value={formatInr(open.reduce((sum, challan) => sum + challan.value, 0))} />
        <StatTile label="Customers waiting for a bill" value={formatQuantity(new Set(open.map((challan) => challan.partyId)).size)} />
      </div>
      <GlassCard className="flex flex-col gap-3.5">
        <ListToolbar
          actions={
            <Link href="/delivery-challans/new" className={buttonClasses("primary", undefined, "lg")}>
              <Plus aria-hidden="true" />
              New challan
            </Link>
          }
        >
          <SearchField
            className="max-w-[340px] flex-[1_1_240px]"
            id="challan-search"
            label="Search challans"
            value={query}
            onChange={setQuery}
            placeholder="Number, customer, vehicle or item"
            trailing={`${visible.length} of ${challans.length}`}
          />
          <FilterGroup label="Show">
            {FILTERS.map((option) => (
              <FilterChip key={option.value} selected={filter === option.value} onClick={() => setFilter(option.value)}>
                {option.label}
              </FilterChip>
            ))}
          </FilterGroup>
        </ListToolbar>
        <GlassTable className="min-w-[760px]">
          <thead>
            <tr>
              <th scope="col" className="text-left">Challan</th>
              <th scope="col" className="text-left">Customer</th>
              <th scope="col" className="text-left">Items</th>
              <th scope="col" className="text-right">Value</th>
              <th scope="col" className="text-left">Status</th>
            </tr>
          </thead>
          <tbody className="font-semibold tabular-nums">
            {visible.map((challan) => (
              <tr key={challan.id} className="align-top">
                <td>
                  <Link href={`/delivery-challans/${challan.id}`} className="hover:text-brand hover:underline">
                    {challan.number}
                  </Link>
                  <div className="text-xs text-muted">
                    {formatDayMonth(challan.date)} · {challan.godownName}
                  </div>
                </td>
                <td>
                  {challan.partyName}
                  {challan.quotation && <div className="text-xs font-medium text-muted">From {challan.quotation.number}</div>}
                </td>
                <td className="text-xs">
                  {challan.lines.slice(0, 2).map((line) => (
                    <div key={line.id}>
                      {line.itemName}: {formatQuantity(line.quantity)} {line.unit}
                    </div>
                  ))}
                  {challan.lines.length > 2 && <div className="text-muted">+{challan.lines.length - 2} more</div>}
                </td>
                <td className="text-right">{formatInr(challan.value)}</td>
                <td>
                  <StatusChip tone={STATUS_TEXT[challan.status].tone}>{STATUS_TEXT[challan.status].label}</StatusChip>
                  {challan.invoice && (
                    <Link href={`/invoices/${challan.invoice.id}`} className="block text-xs text-brand hover:underline">
                      {challan.invoice.number}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </GlassTable>
        {visible.length === 0 && <p className="py-6 text-center text-[13px] text-muted">{challans.length ? "No challans match." : "No delivery challans yet. Dispatch goods from here or from a quotation."}</p>}
      </GlassCard>
    </div>
  );
}
