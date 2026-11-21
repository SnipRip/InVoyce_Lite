"use client";

import Link from "next/link";
import useSWR from "swr";
import { LoadNotice } from "@/components/ui/load-notice";
import { apiGet } from "@/lib/api-client";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import { ITEMS_PATH } from "./item-paths";

export interface StockBatchView {
  batchId: string | null;
  source: { kind: "bill" | "transfer" | "adjustment" | "creditNote" | "opening"; id: string | null; label: string };
  vendor: string | null;
  date: string | null;
  godownId: string;
  godownName: string;
  remaining: number;
  landedRate: number;
}

export interface ItemStockDetailView {
  itemId: string;
  batches: StockBatchView[];
  rates: number[];
  onChallans: number;
}

const SOURCE_HREF: Record<StockBatchView["source"]["kind"], string | null> = {
  bill: "/purchases",
  transfer: "/stock-transfers",
  adjustment: "/stock-adjustments",
  creditNote: "/credit-notes",
  opening: null,
};

// What is in stock of one item, batch by batch (client, 12 Nov 2026): where
// each lot came from, when, at what landed rate, and in which godown. Only
// lots with stock left show, so a rate already sold out never appears. One
// rate in stock shows as a single line.
export function ItemStockDetail({ itemId, unit }: { itemId: string; unit: string }) {
  const { data, error } = useSWR<ItemStockDetailView>(`${ITEMS_PATH}/${itemId}/stock-detail`, apiGet);
  if (!data) return <LoadNotice error={error} what="the stock" />;
  if (data.batches.length === 0) return <p className="text-xs font-medium text-muted">Nothing in stock.</p>;

  const total = data.batches.reduce((sum, batch) => sum + batch.remaining, 0);
  const godowns = [...new Set(data.batches.map((batch) => batch.godownName))];
  return (
    <div className="flex flex-col gap-2 text-left text-[12.5px]">
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-semibold">
        <span>
          {formatQuantity(total)} {unit} in stock
        </span>
        {godowns.length > 1 &&
          godowns.map((name) => (
            <span key={name} className="text-muted">
              {name}: {formatQuantity(data.batches.filter((batch) => batch.godownName === name).reduce((sum, batch) => sum + batch.remaining, 0))}
            </span>
          ))}
        {data.onChallans > 0 && (
          <span className="text-warning-strong">
            {formatQuantity(data.onChallans)} {unit} out on open challans
          </span>
        )}
      </div>
      {data.rates.length === 1 ? (
        <p className="font-medium text-muted">All at one landed rate: {formatRate(data.rates[0])} per {unit}.</p>
      ) : (
        <table className="w-full max-w-[640px] tabular-nums">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 text-left font-medium">From</th>
              <th scope="col" className="py-1 text-left font-medium">Date</th>
              <th scope="col" className="py-1 text-left font-medium">Godown</th>
              <th scope="col" className="py-1 text-right font-medium">Left</th>
              <th scope="col" className="py-1 text-right font-medium">Landed rate</th>
            </tr>
          </thead>
          <tbody>
            {data.batches.map((batch, index) => {
              const base = SOURCE_HREF[batch.source.kind];
              return (
                <tr key={batch.batchId ?? `opening-${index}`} className="border-t border-line">
                  <td className="py-1">
                    {base && batch.source.id ? (
                      <Link href={`${base}/${batch.source.id}`} className="font-semibold hover:text-brand hover:underline">
                        {batch.source.label}
                      </Link>
                    ) : (
                      <span className="font-semibold">{batch.source.label}</span>
                    )}
                    {batch.vendor && <span className="text-muted"> · {batch.vendor}</span>}
                  </td>
                  <td className="py-1">{batch.date ? formatDate(batch.date) : "Opening"}</td>
                  <td className="py-1">{batch.godownName}</td>
                  <td className="py-1 text-right font-semibold">
                    {formatQuantity(batch.remaining)} {unit}
                  </td>
                  <td className="py-1 text-right font-semibold">{formatRate(batch.landedRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
