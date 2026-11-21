import clsx from "clsx";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { formatDate, formatInr, formatPercent, formatQuantity, formatRate } from "@/lib/format";
import { monthLabel } from "./rate-chart-rows";
import type { MonthRow, PartyTotal } from "./types";

const dash = (value: number | null, show: (value: number) => string) => (value === null || value === 0 ? "–" : show(value));

/** Month by month: bought (quantity, landed cost) and sold (quantity, value, cost, profit). Newest first. */
export function ItemMonthsTable({ months }: { months: MonthRow[] }) {
  return (
    <GlassCard className="flex flex-col gap-3">
      <CardTitle>Month by month</CardTitle>
      {months.length === 0 ? (
        <p className="text-sm font-medium text-muted">Nothing bought or sold yet.</p>
      ) : (
        <GlassTable className="min-w-[720px]">
          <thead>
            <tr className="text-right">
              <th scope="col" className="text-left">Month</th>
              <th scope="col">Bought</th>
              <th scope="col">Landed cost</th>
              <th scope="col">Sold</th>
              <th scope="col">Sales</th>
              <th scope="col">Cost of sales</th>
              <th scope="col">Profit</th>
              <th scope="col">Margin</th>
            </tr>
          </thead>
          <tbody className="text-right tabular-nums">
            {months.toReversed().map((row) => (
              <tr key={row.month}>
                <td className="text-left font-semibold">{monthLabel(row.month)}</td>
                <td>{dash(row.purchased, formatQuantity)}</td>
                <td>{dash(row.purchaseValue, formatInr)}</td>
                <td>{dash(row.sold, formatQuantity)}</td>
                <td>{dash(row.sales, formatInr)}</td>
                <td>{dash(row.costOfSales, formatInr)}</td>
                <td className={clsx("font-semibold", row.profit < 0 && "text-danger-strong")}>{row.sold ? formatInr(row.profit) : "–"}</td>
                <td>{dash(row.marginPct, formatPercent)}</td>
              </tr>
            ))}
          </tbody>
        </GlassTable>
      )}
    </GlassCard>
  );
}

/** Who bought the item (with the profit on it) or who sold it to us (with the average landed rate). */
export function ItemPartiesTable({ title, rows, side, unit }: { title: string; rows: PartyTotal[]; side: "customer" | "vendor"; unit: string }) {
  return (
    <GlassCard className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-sm font-medium text-muted">{side === "customer" ? "Not sold yet." : "Not bought on a bill yet."}</p>
      ) : (
        <GlassTable className="min-w-[520px]">
          <thead>
            <tr className="text-right">
              <th scope="col" className="text-left">{side === "customer" ? "Customer" : "Vendor"}</th>
              <th scope="col">{side === "customer" ? "Invoices" : "Bills"}</th>
              <th scope="col">Quantity</th>
              <th scope="col">{side === "customer" ? "Sales" : "Landed value"}</th>
              <th scope="col">Avg rate</th>
              <th scope="col">Last rate</th>
              {side === "customer" && <th scope="col">Profit</th>}
            </tr>
          </thead>
          <tbody className="text-right tabular-nums">
            {rows.map((row) => (
              <tr key={row.party}>
                <td className="text-left">
                  <span className="font-semibold">{row.party}</span>
                  <div className="text-xs text-muted">Last {formatDate(row.lastDate)}</div>
                </td>
                <td>{row.documents}</td>
                <td>
                  {formatQuantity(row.quantity)} <span className="text-xs text-muted">{unit}</span>
                </td>
                <td>{formatInr(row.value)}</td>
                <td>{row.averageRate !== null ? formatRate(row.averageRate) : "–"}</td>
                <td>{row.lastRate !== null ? formatRate(row.lastRate) : "–"}</td>
                {side === "customer" && <td className={clsx("font-semibold", row.profit < 0 ? "text-danger-strong" : "text-success-strong")}>{formatInr(row.profit)}</td>}
              </tr>
            ))}
          </tbody>
        </GlassTable>
      )}
    </GlassCard>
  );
}
