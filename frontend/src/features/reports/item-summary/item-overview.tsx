import Link from "next/link";
import { FactTile } from "@/components/ui/fact-tile";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { itemPictureUrl } from "@/features/items/item-paths";
import { formatDate, formatInr, formatPercent, formatQuantity, formatRate } from "@/lib/format";
import type { ItemSummaryView } from "./types";

const STOCK_TONE: Record<string, StatusTone> = { "Out of stock": "danger", Reorder: "warning", OK: "success" };
const rate = (value: number | null) => (value === null ? "–" : formatRate(value));

// The top of the item summary: what the item is, where its stock stands
// today, what it is worth, the rates it moves at, and its lifetime trading.
export function ItemOverview({ data }: { data: ItemSummaryView }) {
  const { item, stock, prices, totals } = data;
  const unit = item.unit;
  return (
    <>
      <GlassCard className="flex flex-wrap items-start gap-4">
        {item.pictureId && (
          // eslint-disable-next-line @next/next/no-img-element -- served by our API, sized here
          <img src={itemPictureUrl(item.id, item.pictureId)} alt="" className="size-20 shrink-0 rounded-(--radius-tile) object-cover" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <StatusChip tone={STOCK_TONE[stock.status] ?? "neutral"}>{stock.status}</StatusChip>
            {item.isArchived && <StatusChip tone="neutral">Archived</StatusChip>}
          </div>
          <p className="text-[13px] font-medium text-muted">
            {[item.sku, item.category, item.subCategory, item.brand, `HSN ${item.hsn}`].filter(Boolean).join(" · ")}
          </p>
          <Link href={`/items/${item.id}`} className="self-start text-[13px] font-semibold text-brand hover:underline">
            Open the item
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-3">
          <FactTile label="MRP">{rate(item.mrp)}</FactTile>
          <FactTile label="Reorder level">
            {formatQuantity(item.reorderLevel)} {unit}
          </FactTile>
          <FactTile label="Days of stock">{stock.daysOfStock === null ? "No recent sales" : `${formatQuantity(stock.daysOfStock)} days`}</FactTile>
        </dl>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 min-[1700px]:grid-cols-8">
        <StatTile label={`In stock (${unit})`} value={formatQuantity(stock.onHand)} tone={STOCK_TONE[stock.status]} />
        <StatTile label="Stock value" value={formatInr(stock.value)} />
        <StatTile label="Average cost" value={rate(stock.averageCost)} />
        <StatTile label="Last landed cost" value={rate(stock.lastLandedCost)} />
        <StatTile label="Today's list rate" value={rate(prices.listRate)} />
        <StatTile label="Last sale rate" value={rate(prices.lastSaleRate)} />
        <StatTile label="Total profit" value={formatInr(totals.profit)} tone={totals.profit < 0 ? "danger" : totals.profit > 0 ? "success" : undefined} />
        <StatTile label="Margin" value={totals.marginPct === null ? "–" : formatPercent(totals.marginPct)} />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <GlassCard className="flex flex-col gap-3">
          <CardTitle>Stock today</CardTitle>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <FactTile label="On hand">
              {formatQuantity(stock.onHand)} {unit}
            </FactTile>
            <FactTile label="Held on open challans">
              {formatQuantity(stock.onChallans)} {unit}
            </FactTile>
            <FactTile label="Free to sell">
              {formatQuantity(stock.free)} {unit}
            </FactTile>
            <FactTile label="Sold in the last 90 days">
              {formatQuantity(stock.soldLast90Days)} {unit}
            </FactTile>
          </dl>
          {stock.byGodown.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13px]">
              {stock.byGodown.map((row) => (
                <li key={row.godown} className="flex justify-between gap-3 tabular-nums">
                  <span className="font-medium text-ink-soft">{row.godown}</span>
                  <span className="font-semibold">
                    {formatQuantity(row.quantity)} {unit} · {formatInr(row.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <CardTitle>Rates</CardTitle>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <FactTile label="List rate today">
              {rate(prices.listRate)}
              {prices.listMarginPct !== null && <span className="ml-1 text-xs text-muted">{formatPercent(prices.listMarginPct)} margin</span>}
            </FactTile>
            <FactTile label="List minimum">{rate(prices.listMinimum)}</FactTile>
            <FactTile label="Last sold">
              {rate(prices.lastSaleRate)}
              {prices.lastSaleDate && <span className="ml-1 text-xs text-muted">{formatDate(prices.lastSaleDate)}</span>}
            </FactTile>
            <FactTile label="Last bought (landed)">
              {rate(prices.lastPurchaseRate)}
              {prices.lastPurchaseDate && <span className="ml-1 text-xs text-muted">{formatDate(prices.lastPurchaseDate)}</span>}
            </FactTile>
            <FactTile label="Average sale rate">{rate(prices.averageSaleRate)}</FactTile>
            <FactTile label="Average landed rate">{rate(prices.averagePurchaseRate)}</FactTile>
            <FactTile label="Lowest sale">{rate(prices.lowestSaleRate)}</FactTile>
            <FactTile label="Highest sale">{rate(prices.highestSaleRate)}</FactTile>
          </dl>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <CardTitle>All-time trading</CardTitle>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <FactTile label="Bought on bills">
              {formatQuantity(totals.purchased)} {unit}
            </FactTile>
            <FactTile label="Landed cost">{formatInr(totals.purchaseValue)}</FactTile>
            <FactTile label="Sold">
              {formatQuantity(totals.sold)} {unit}
            </FactTile>
            <FactTile label="Sales before GST">{formatInr(totals.sales)}</FactTile>
            <FactTile label="Cost of sales">{formatInr(totals.costOfSales)}</FactTile>
            <FactTile label="Profit">{formatInr(totals.profit)}</FactTile>
            <FactTile label="Customer returns">
              {formatQuantity(totals.returnedByCustomers)} {unit}
              {totals.salesReturns > 0 && <span className="ml-1 text-xs text-muted">{formatInr(totals.salesReturns)} credited</span>}
            </FactTile>
            <FactTile label="Back to vendors / written off">
              {formatQuantity(totals.returnedToVendors)} / {formatQuantity(totals.writtenOff)}
            </FactTile>
          </dl>
        </GlassCard>
      </div>
    </>
  );
}
