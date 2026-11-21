"use client";

import Link from "next/link";
import useSWR from "swr";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { LoadNotice } from "@/components/ui/load-notice";
import { apiGet } from "@/lib/api-client";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import { ITEMS_PATH } from "./item-paths";

interface ItemHistoryRow {
  date: string | null;
  kind: string;
  number: string | null;
  href: string | null;
  party: string | null;
  godown: string;
  quantityIn: number;
  quantityOut: number;
  rate: number;
  balance: number;
}

// An item's full history (client, 12 Nov 2026): every purchase, sale,
// return, transfer and adjustment, with who it was with, the rate and the
// stock after it. Challans show for the record; they move no stock until
// invoiced.
export function ItemHistory({ itemId, unit }: { itemId: string; unit: string }) {
  const { data, error } = useSWR<ItemHistoryRow[]>(`${ITEMS_PATH}/${itemId}/history`, apiGet);
  return (
    <GlassCard className="flex flex-col gap-3">
      <CardTitle>History</CardTitle>
      {!data ? (
        <LoadNotice error={error} what="the history" />
      ) : data.length === 0 ? (
        <p className="text-sm font-medium text-muted">Nothing has moved this item yet.</p>
      ) : (
        <GlassTable className="min-w-[720px]">
          <thead>
            <tr className="text-right">
              <th scope="col" className="text-left">Date</th>
              <th scope="col" className="text-left">What</th>
              <th scope="col" className="text-left">With</th>
              <th scope="col">In</th>
              <th scope="col">Out</th>
              <th scope="col">Rate</th>
              <th scope="col">Stock after</th>
            </tr>
          </thead>
          <tbody className="text-right tabular-nums">
            {data.map((row, index) => (
              <tr key={`${row.kind}-${row.number}-${index}`} className={row.kind === "Challan" ? "text-muted" : undefined}>
                <td className="text-left whitespace-nowrap">{row.date ? formatDate(row.date) : "Opening"}</td>
                <td className="text-left">
                  <span className="font-semibold">{row.kind}</span>
                  {row.number && (
                    <div className="text-xs">
                      {row.href ? (
                        <Link href={row.href} className="text-brand hover:underline">
                          {row.number}
                        </Link>
                      ) : (
                        row.number
                      )}
                    </div>
                  )}
                </td>
                <td className="text-left">
                  {row.party ?? ""}
                  <div className="text-xs text-muted">{row.godown}</div>
                </td>
                <td className="font-semibold text-success-strong">{row.quantityIn && row.kind !== "Transfer" ? formatQuantity(row.quantityIn) : ""}</td>
                <td className="font-semibold">{row.quantityOut && row.kind !== "Transfer" ? formatQuantity(row.quantityOut) : row.kind === "Transfer" ? formatQuantity(row.quantityIn) : ""}</td>
                <td>{row.rate ? formatRate(row.rate) : ""}</td>
                <td className="font-semibold">
                  {formatQuantity(row.balance)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </GlassTable>
      )}
    </GlassCard>
  );
}
