import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/ui/status-chip";
import type { TaxDecision } from "@/features/gst/gst-rules";
import type { InvoiceTotals } from "@/features/invoices/invoice-rules";
import { formatInr, formatPercent, formatRate } from "@/lib/format";

interface QuotationTotalsCardProps {
  totals: InvoiceTotals;
  tax?: TaxDecision;
  schemeDiscount: number;
  profit: { profit: number; marginPct: number };
  costMissing: boolean;
}

// Running totals beside the quotation form, with the profit only we see.
export function QuotationTotalsCard({ totals, tax, schemeDiscount, profit, costMissing }: QuotationTotalsCardProps) {
  return (
    <GlassCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Totals</CardTitle>
        {tax && <StatusChip tone={tax.regime === "no-gst" ? "warning" : "brand"}>{tax.title}</StatusChip>}
      </div>
      <dl className="flex flex-col gap-1.5 text-sm font-semibold">
        {schemeDiscount > 0 && (
          <>
            <div className="flex justify-between">
              <dt>Items</dt>
              <dd className="tabular-nums">{formatRate(totals.taxable + schemeDiscount)}</dd>
            </div>
            <div className="flex justify-between text-success-strong">
              <dt>Schemes</dt>
              <dd className="tabular-nums">− {formatRate(schemeDiscount)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <dt>Value before GST</dt>
          <dd className="tabular-nums">{formatRate(totals.taxable)}</dd>
        </div>
        {Object.entries(totals.taxByName).map(([name, amount]) => (
          <div key={name} className="flex justify-between">
            <dt>{name}</dt>
            <dd className="tabular-nums">{formatRate(amount ?? 0)}</dd>
          </div>
        ))}
        {Object.keys(totals.taxByName).length === 0 && (
          <div className="flex justify-between text-muted">
            <dt>GST</dt>
            <dd>None</dd>
          </div>
        )}
        <div className="my-1 border-t border-line" />
        <div className="flex justify-between text-lg font-semibold">
          <dt>Quotation total</dt>
          <dd className="tabular-nums">{formatInr(totals.grandTotal)}</dd>
        </div>
      </dl>
      <div className="glass-inset mt-1 flex justify-between rounded-(--radius-tile) px-4 py-3 text-sm font-semibold">
        <span>Profit {formatInr(profit.profit)}</span>
        <span className={profit.marginPct < 8 ? "text-danger-strong" : "text-success-strong"}>{formatPercent(profit.marginPct)}</span>
      </div>
      <p className="text-xs font-semibold text-muted">
        Margin is on the last landed cost (freight and unloading included), free units counted. Only you see it; it is not printed.
        {costMissing && " Some items have no stock yet, so their cost counts as nil."}
      </p>
    </GlassCard>
  );
}
