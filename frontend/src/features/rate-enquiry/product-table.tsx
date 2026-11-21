"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassTable } from "@/components/ui/glass-table";
import { ItemStockDetail } from "@/features/items/item-stock-detail";
import { StockCell } from "@/features/items/stock-cell";
import { formatDate, formatPercent, formatRate } from "@/lib/format";
import type { RateEnquiryItemView } from "@/types/rate-enquiry";
import { itemMargin } from "./enquiry-rules";

interface ProductTableProps {
  items: RateEnquiryItemView[];
  /** Item ids already in the quotation draft. */
  addedIds: Set<string>;
  onToggle: (item: RateEnquiryItemView) => void;
  /** No live items at all (not just none matching). */
  empty: boolean;
}

/** What the rate is under the figure: where it came from, and the customer's last rates. */
function RateNote({ item }: { item: RateEnquiryItemView }) {
  const { options } = item;
  const notes = [
    options.source === "special" ? "Special rate" : options.source === "price-list" ? "Price list" : undefined,
    options.rate === null && options.previousSheetRate
      ? `Was ${formatRate(options.previousSheetRate.rate)} till ${formatDate(options.previousSheetRate.validTill)}`
      : undefined,
    options.lastSold ? `Last sold ${formatRate(options.lastSold.rate)}` : options.lastQuoted ? `Last quoted ${formatRate(options.lastQuoted.rate)}` : undefined,
  ].filter(Boolean);
  return notes.length ? <div className="text-xs font-medium text-muted">{notes.join(" · ")}</div> : null;
}

/**
 * Search results: stock, MRP, cost, the customer's rate and margin
 * per item. "Stock" opens the stock enquiry under the row: each lot in stock
 * with its purchase rate and godown (client, 12 Nov 2026).
 */
export function ProductTable({ items, addedIds, onToggle, empty }: ProductTableProps) {
  const [open, setOpen] = useState<string | null>(null);
  if (items.length === 0) {
    return <p className="py-6 text-center text-[13px] text-muted">{empty ? "No items yet. Add them on the Items page." : "No products match this search."}</p>;
  }

  return (
    <GlassTable className="min-w-[760px]">
      <thead>
        <tr className="text-right">
          <th scope="col" className="text-left">
            Product
          </th>
          <th scope="col">In stock</th>
          <th scope="col">MRP</th>
          <th scope="col">Cost</th>
          <th scope="col">Rate</th>
          <th scope="col">Margin</th>
          <th scope="col">
            <span className="sr-only">Add to quotation</span>
          </th>
        </tr>
      </thead>
      <tbody className="text-right font-semibold tabular-nums">
        {items.map((item) => {
          const isAdded = addedIds.has(item.itemId);
          const { options } = item;
          const margin = itemMargin(item);
          const detail = [item.sku, item.brandName, item.subCategoryName ?? item.categoryName, item.unit && `per ${item.unit}`].filter(Boolean).join(" · ");
          const expanded = open === item.itemId;
          return (
            <Fragment key={item.itemId}>
              <tr>
                <td className="text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted">{detail}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <StockCell item={item} unit={item.unit ?? undefined} />
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : item.itemId)}
                    className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold text-brand hover:underline"
                  >
                    Stock
                    <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                </td>
                <td>{options.mrp !== null ? formatRate(options.mrp) : "—"}</td>
                <td>{options.marginCost !== null ? formatRate(options.marginCost) : <span className="whitespace-nowrap text-muted">No cost yet</span>}</td>
                <td>
                  {options.rate !== null ? (
                    <div className="font-semibold text-brand">{formatRate(options.rate)}</div>
                  ) : (
                    <div className="whitespace-nowrap text-muted">No rate today</div>
                  )}
                  <RateNote item={item} />
                </td>
                <td className={margin !== null && margin < 0 ? "text-danger-strong" : "text-success-strong"}>
                  {margin !== null ? formatPercent(margin) : "—"}
                </td>
                <td>
                  <Button
                    variant={isAdded ? "success" : "outline"}
                    aria-pressed={isAdded}
                    aria-label={`${isAdded ? "Remove" : "Add"} ${item.name}`}
                    onClick={() => onToggle(item)}
                    className="min-w-[84px]"
                  >
                    {isAdded ? "Added" : "Add"}
                  </Button>
                </td>
              </tr>
              {expanded && (
                <tr>
                  <td colSpan={7} className="bg-ink/[0.025]">
                    <ItemStockDetail itemId={item.itemId} unit={item.unit ?? ""} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </GlassTable>
  );
}
