"use client";

import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { formatDate, formatInr, formatPercent, formatQuantity, formatRate } from "@/lib/format";
import type { LotKind, LotStatus, LotView } from "./types";

const STATUS_TONE: Record<LotStatus, StatusTone> = { "In stock": "brand", "Partly sold": "warning", "Sold out": "success", Gone: "neutral" };
const SOURCE_HREF: Record<LotKind, string | null> = { bill: "/purchases", adjustment: "/stock-adjustments", creditNote: "/credit-notes", opening: null };
const KIND_TEXT: Record<LotKind, string> = { bill: "Purchase", opening: "Opening stock", adjustment: "Stock added", creditNote: "Customer return" };

type Filter = "all" | "inStock" | "sold";
const FILTERS: { value: Filter; label: string; keep: (lot: LotView) => boolean }[] = [
  { value: "all", label: "All lots", keep: () => true },
  { value: "inStock", label: "Still in stock", keep: (lot) => lot.remaining > 0 },
  { value: "sold", label: "Sold or partly sold", keep: (lot) => lot.sold > 0 },
];

const sum = (lots: LotView[], pick: (lot: LotView) => number) => lots.reduce((total, lot) => total + pick(lot), 0);

// Batch-wise stock and profit: every lot the item came in as, at its landed
// rate, with what was sold from it, at what value and profit, what went back
// to the vendor or was written off, and what is left. A row opens to the
// invoices that drew on it.
export function ItemLotsTable({ lots, unit }: { lots: LotView[]; unit: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const shown = lots.filter(FILTERS.find((entry) => entry.value === filter)!.keep);
  const sales = sum(shown, (lot) => lot.sales);
  const cost = sum(shown, (lot) => lot.costOfSales);

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <CardTitle>Batch-wise stock and profit</CardTitle>
        <FilterGroup label="Lots" className="ml-auto">
          {FILTERS.map((entry) => (
            <FilterChip key={entry.value} selected={filter === entry.value} onClick={() => setFilter(entry.value)}>
              {entry.label}
            </FilterChip>
          ))}
        </FilterGroup>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm font-medium text-muted">No lots here.</p>
      ) : (
        <GlassTable className="min-w-[1080px]">
          <thead>
            <tr className="text-right">
              <th scope="col" className="w-6" />
              <th scope="col" className="text-left">Lot</th>
              <th scope="col" className="text-left">From</th>
              <th scope="col">Landed rate</th>
              <th scope="col">Received</th>
              <th scope="col">Sold</th>
              <th scope="col">Back / off</th>
              <th scope="col">Left</th>
              <th scope="col">Sale rate</th>
              <th scope="col">Sales</th>
              <th scope="col">Cost</th>
              <th scope="col">Profit</th>
              <th scope="col">Margin</th>
              <th scope="col" className="text-left">Status</th>
            </tr>
          </thead>
          <tbody className="text-right tabular-nums">
            {shown.map((lot) => {
              const expanded = open === lot.key;
              const href = lot.sourceId && SOURCE_HREF[lot.kind] ? `${SOURCE_HREF[lot.kind]}/${lot.sourceId}` : null;
              return (
                <Fragment key={lot.key}>
                  <tr>
                    <td>
                      {lot.saleSlices.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} sales from ${lot.label}`}
                          onClick={() => setOpen(expanded ? null : lot.key)}
                          className="grid size-6 place-items-center rounded-md text-muted hover:bg-white/60 hover:text-ink"
                        >
                          <ChevronRight aria-hidden="true" className={clsx("size-4 transition-transform", expanded && "rotate-90")} />
                        </button>
                      )}
                    </td>
                    <td className="text-left">
                      <span className="font-semibold">{href ? <Link href={href} className="text-brand hover:underline">{lot.label}</Link> : lot.label}</span>
                      <div className="text-xs text-muted">
                        {KIND_TEXT[lot.kind]} · {lot.date ? formatDate(lot.date) : "Before the books"} · {lot.godown}
                      </div>
                    </td>
                    <td className="text-left">{lot.party ?? "–"}</td>
                    <td className="font-semibold">{formatRate(lot.landedRate)}</td>
                    <td>{formatQuantity(lot.received)}</td>
                    <td>{lot.sold ? formatQuantity(lot.sold) : "–"}</td>
                    <td className="text-muted">{lot.returned + lot.writtenOff ? formatQuantity(lot.returned + lot.writtenOff) : "–"}</td>
                    <td className="font-semibold whitespace-nowrap">
                      {formatQuantity(lot.remaining)} <span className="text-xs font-medium text-muted">{unit}</span>
                    </td>
                    <td>{lot.saleRate !== null ? formatRate(lot.saleRate) : "–"}</td>
                    <td>{lot.sales ? formatInr(lot.sales) : "–"}</td>
                    <td>{lot.costOfSales ? formatInr(lot.costOfSales) : "–"}</td>
                    <td className={clsx("font-semibold", lot.profit < 0 && "text-danger-strong", lot.profit > 0 && "text-success-strong")}>{lot.sold ? formatInr(lot.profit) : "–"}</td>
                    <td>{lot.marginPct !== null ? formatPercent(lot.marginPct) : "–"}</td>
                    <td className="text-left">
                      <StatusChip tone={STATUS_TONE[lot.status]}>{lot.status}</StatusChip>
                    </td>
                  </tr>
                  {expanded &&
                    lot.saleSlices.map((slice, index) => (
                      <tr key={`${lot.key}-${slice.invoiceId}-${index}`} className="text-[12.5px] text-ink-soft">
                        <td />
                        <td className="text-left">
                          <Link href={`/invoices/${slice.invoiceId}`} className="text-brand hover:underline">
                            {slice.invoice}
                          </Link>
                          <div className="text-xs text-muted">{formatDate(slice.date)}</div>
                        </td>
                        <td className="text-left">{slice.customer}</td>
                        <td />
                        <td />
                        <td>{formatQuantity(slice.quantity)}</td>
                        <td />
                        <td />
                        <td>{slice.sales && slice.quantity ? formatRate(slice.sales / slice.quantity) : "Free"}</td>
                        <td>{formatInr(slice.sales)}</td>
                        <td>{formatInr(slice.cost)}</td>
                        <td className={clsx(slice.sales - slice.cost < 0 && "text-danger-strong")}>{formatInr(slice.sales - slice.cost)}</td>
                        <td>{slice.sales > 0 ? formatPercent(((slice.sales - slice.cost) / slice.sales) * 100) : "–"}</td>
                        <td />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="text-right font-semibold tabular-nums">
            <tr>
              <td />
              <td className="text-left" colSpan={3}>
                {shown.length} {shown.length === 1 ? "lot" : "lots"}
              </td>
              <td>{formatQuantity(sum(shown, (lot) => lot.received))}</td>
              <td>{formatQuantity(sum(shown, (lot) => lot.sold))}</td>
              <td>{formatQuantity(sum(shown, (lot) => lot.returned + lot.writtenOff))}</td>
              <td>{formatQuantity(sum(shown, (lot) => lot.remaining))}</td>
              <td />
              <td>{formatInr(sales)}</td>
              <td>{formatInr(cost)}</td>
              <td className={clsx(sales - cost < 0 ? "text-danger-strong" : "text-success-strong")}>{formatInr(sales - cost)}</td>
              <td>{sales > 0 ? formatPercent(((sales - cost) / sales) * 100) : "–"}</td>
              <td />
            </tr>
          </tfoot>
        </GlassTable>
      )}
    </GlassCard>
  );
}
