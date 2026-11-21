"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { StatTile } from "@/components/ui/stat-tile";
import { ViewTabs } from "@/components/ui/view-tabs";
import { formatDate, formatInr, formatPercent } from "@/lib/format";
import type { ProfitReportView, ProfitRowKind, ProfitRowView } from "@/types/profit";
import { profitRowHref } from "./profit-api";

// A credit-note row only appears inside the invoice view; it is not a view of its own.
type View = Exclude<ProfitRowKind, "creditNote">;

const VIEWS: { value: View; label: string; first: string }[] = [
  { value: "invoice", label: "By invoice", first: "Invoice" },
  { value: "customer", label: "By customer", first: "Customer" },
  { value: "item", label: "By item", first: "Item" },
];

type SortKey = "profit" | "marginPct" | "sales";

const ROWS: Record<View, (report: ProfitReportView) => ProfitRowView[]> = {
  invoice: (report) => report.byInvoice,
  customer: (report) => report.byCustomer,
  item: (report) => report.byItem,
};

// Actual profit: sales value less purchase cost less the expenses
// allocated to each sale, all before GST. Overheads come off once, at the end.
export function ProfitWorkspace({ report }: { report: ProfitReportView }) {
  const [view, setView] = useState<View>("invoice");
  const [sort, setSort] = useState<SortKey>("profit");
  const { total, overheads, otherIncome, otherExpenses, netProfit: net } = report;
  const visible = [...ROWS[view](report)].sort((a, b) => b[sort] - a[sort]);
  const widest = Math.max(...visible.map((row) => Math.abs(row.profit)), 1);
  const offSales = overheads.total + otherExpenses;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Sales, before GST" value={formatInr(total.sales)} />
        <StatTile label="Profit on sales" value={formatInr(total.profit)} tone={total.profit < 0 ? "danger" : "success"} />
        <StatTile label={otherIncome ? "Indirect expenses less other income" : "Indirect expenses"} value={formatInr(offSales - otherIncome)} />
        <StatTile label="Net profit" value={formatInr(net)} tone={net < 0 ? "danger" : "success"} />
      </div>

      <GlassCard className="flex flex-col gap-3.5">
        <ViewTabs label="Group profit by" tabs={VIEWS} value={view} onChange={setView} className="-mx-4 -mt-1 px-4 sm:-mx-[18px] sm:px-[18px]" />
        <GlassTable className="min-w-[880px]">
          <thead>
            <tr className="text-right">
              <th scope="col" className="text-left">{VIEWS.find((option) => option.value === view)?.first}</th>
              <SortHeader label="Sales" active={sort === "sales"} onClick={() => setSort("sales")} />
              <th scope="col">Purchase cost</th>
              <th scope="col">Expenses</th>
              <SortHeader label="Profit" active={sort === "profit"} onClick={() => setSort("profit")} />
              <SortHeader label="Margin" active={sort === "marginPct"} onClick={() => setSort("marginPct")} />
              <th scope="col" className="w-40">
                <span className="sr-only">Profit bar</span>
              </th>
            </tr>
          </thead>
          <tbody className="text-right font-semibold tabular-nums">
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm font-medium text-muted">
                  No issued invoices between {formatDate(report.from)} and {formatDate(report.to)}.
                </td>
              </tr>
            )}
            {visible.map((row) => (
              <tr key={row.key}>
                <td className="text-left">
                  {profitRowHref(row) ? (
                    <Link href={profitRowHref(row)!} className="font-semibold hover:text-brand hover:underline">
                      {row.label}
                    </Link>
                  ) : (
                    <span className="font-semibold">{row.label}</span>
                  )}
                  {row.detail && <div className="text-xs text-muted">{row.detail}</div>}
                </td>
                <td>{formatInr(row.sales)}</td>
                <td className="text-muted">{formatInr(row.cost)}</td>
                <td className="text-muted">{formatInr(row.expenses)}</td>
                <td className={clsx("font-semibold", row.profit < 0 && "text-danger-strong")}>{formatInr(row.profit)}</td>
                <td className={row.marginPct < 8 ? "text-danger-strong" : undefined}>{formatPercent(row.marginPct)}</td>
                <td>
                  <span aria-hidden="true" className="block h-2.5 rounded-full bg-ink/5">
                    <span
                      className={clsx("block h-full rounded-full", row.profit < 0 ? "bg-danger" : "bg-success")}
                      style={{ width: `${(Math.abs(row.profit) / widest) * 100}%` }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-right font-semibold tabular-nums">
            <tr className="border-t border-line">
              <td className="text-left">Total</td>
              <td>{formatInr(total.sales)}</td>
              <td>{formatInr(total.cost)}</td>
              <td>{formatInr(total.expenses)}</td>
              <td>{formatInr(total.profit)}</td>
              <td>{formatPercent(total.marginPct)}</td>
              <td />
            </tr>
          </tfoot>
        </GlassTable>
      </GlassCard>

      <GlassCard className="flex flex-col gap-2">
        <CardTitle>Off net profit</CardTitle>
        <GlassTable>
          <tbody className="tabular-nums">
            {overheads.byHead.map((row) => (
              <tr key={row.head}>
                <td>
                  <span className="font-semibold">{row.head}</span>
                  <div className="text-xs text-muted">
                    {row.count} expense{row.count === 1 ? "" : "s"}, overhead
                  </div>
                </td>
                <td className="text-right font-semibold">{formatInr(row.amount)}</td>
              </tr>
            ))}
            {otherExpenses !== 0 && (
              <tr>
                <td>
                  <span className="font-semibold">Other indirect expenses</span>
                  <div className="text-xs text-muted">Loan interest, bank charges, stock written off, overhead bills and journals, from the books</div>
                </td>
                <td className="text-right font-semibold">{formatInr(otherExpenses)}</td>
              </tr>
            )}
            {otherIncome !== 0 && (
              <tr>
                <td>
                  <span className="font-semibold">Other income</span>
                  <div className="text-xs text-muted">Interest received, stock found and other indirect incomes, added back</div>
                </td>
                <td className="text-right font-semibold text-success-strong">+ {formatInr(otherIncome)}</td>
              </tr>
            )}
            {offSales === 0 && otherIncome === 0 && (
              <tr>
                <td colSpan={2} className="text-sm font-medium text-muted">
                  No indirect expenses or income in this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="tabular-nums">
            <tr className="border-t border-line font-semibold">
              <td>
                Profit on sales {formatInr(total.profit)} less {formatInr(offSales)}
                {otherIncome ? ` plus ${formatInr(otherIncome)}` : ""}
              </td>
              <td className={clsx("text-right", net < 0 && "text-danger-strong")}>{formatInr(net)}</td>
            </tr>
          </tfoot>
        </GlassTable>
      </GlassCard>

      <GlassCard className="flex flex-col gap-2">
        <CardTitle>How this is worked out</CardTitle>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm font-medium text-ink-soft">
          <li>Sales are the invoice value before GST; GST never counts as income or cost.</li>
          <li>Purchase cost is the landed cost of the batches each invoice drew, first in, first out: freight, unloading and other expenses booked on a purchase&rsquo;s items are already inside it, so they are not counted again.</li>
          <li>Expenses are counted at their cost: the amount plus any GST that cannot be claimed.</li>
          <li>Expenses booked on an invoice are shared over its items by value.</li>
          <li>Rent, salary and other overheads come off once, as net profit. Only issued invoices count.</li>
          <li>Indirect expenses and incomes booked outside the expense register (loan interest, bank charges, stock written off or found, overhead bills, journals) come from the books, so net profit agrees with them.</li>
        </ul>
      </GlassCard>
    </div>
  );
}

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th scope="col" aria-sort={active ? "descending" : "none"}>
      <button type="button" onClick={onClick} className={clsx("font-semibold hover:text-brand", active && "text-brand-strong underline")}>
        {label}
      </button>
    </th>
  );
}
