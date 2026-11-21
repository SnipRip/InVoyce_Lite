"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { formatDate, formatDayMonth, formatQuantity, formatRate } from "@/lib/format";
import { rateChartRows } from "./rate-chart-rows";
import type { RatePoint } from "./types";

const SERIES = [
  { key: "purchase", name: "Landed purchase rate", color: "var(--color-brand-soft)" },
  { key: "sale", name: "Sale rate", color: "var(--color-brand)" },
  { key: "list", name: "Price list", color: "var(--color-success)" },
] as const;

const KIND_TEXT: Record<RatePoint["kind"], string> = { purchase: "Purchase", sale: "Sale", list: "Price list" };

type Shown = "all" | RatePoint["kind"];
const tick = { fill: "var(--color-muted)", fontSize: 12, fontWeight: 600 };

// Every rate the item was bought, sold and listed at, as a chart over time and
// as a table underneath (newest first), filterable by kind.
export function ItemRateHistory({ rates, unit }: { rates: RatePoint[]; unit: string }) {
  const [shown, setShown] = useState<Shown>("all");
  const rows = useMemo(() => rateChartRows(rates), [rates]);
  const listed = rates.filter((point) => shown === "all" || point.kind === shown).toReversed();

  return (
    <GlassCard className="flex flex-col gap-3.5">
      <CardTitle>Rate history · ₹ per {unit || "unit"}, before GST</CardTitle>
      {rows.length === 0 ? (
        <p className="text-sm font-medium text-muted">No purchase, sale or price list rate yet.</p>
      ) : (
        <>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="date" tickFormatter={formatDayMonth} tickLine={false} axisLine={false} tick={tick} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tick={tick} domain={["auto", "auto"]} width={56} />
                <Tooltip
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) => formatRate(Number(value))}
                  wrapperClassName="glass-popover !rounded-(--radius-tile) !border-0 !px-3.5 !py-2.5 text-[13px] font-semibold tabular-nums"
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink-soft)" }} />
                {SERIES.map((series) => (
                  <Line
                    key={series.key}
                    dataKey={series.key}
                    name={series.name}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    type={series.key === "list" ? "stepAfter" : "monotone"}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <FilterGroup label="Show">
            {(["all", "purchase", "sale", "list"] as const).map((kind) => (
              <FilterChip key={kind} selected={shown === kind} onClick={() => setShown(kind)}>
                {kind === "all" ? "All" : KIND_TEXT[kind]}
              </FilterChip>
            ))}
          </FilterGroup>
          <div className="max-h-[340px] overflow-y-auto">
            <GlassTable className="min-w-[640px]">
              <thead>
                <tr className="text-right">
                  <th scope="col" className="text-left">Date</th>
                  <th scope="col" className="text-left">Kind</th>
                  <th scope="col" className="text-left">Document</th>
                  <th scope="col" className="text-left">With</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Bill rate</th>
                  <th scope="col">Rate</th>
                </tr>
              </thead>
              <tbody className="text-right tabular-nums">
                {listed.map((point, index) => (
                  <tr key={`${point.kind}-${point.number}-${point.date}-${index}`}>
                    <td className="text-left whitespace-nowrap">{formatDate(point.date)}</td>
                    <td className="text-left">{KIND_TEXT[point.kind]}</td>
                    <td className="text-left">
                      {point.href ? (
                        <Link href={point.href} className="text-brand hover:underline">
                          {point.number}
                        </Link>
                      ) : (
                        (point.number ?? "")
                      )}
                    </td>
                    <td className="text-left">{point.party ?? ""}</td>
                    <td>{point.quantity !== null ? formatQuantity(point.quantity) : ""}</td>
                    <td className="text-muted">{point.billRate !== null ? formatRate(point.billRate) : ""}</td>
                    <td className="font-semibold">{formatRate(point.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </GlassTable>
          </div>
        </>
      )}
    </GlassCard>
  );
}
