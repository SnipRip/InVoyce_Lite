"use client";

import { Printer } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { GlassCard } from "@/components/ui/glass-card";
import { LoadNotice } from "@/components/ui/load-notice";
import { ItemHistory } from "@/features/items/item-history";
import { ITEMS_PATH } from "@/features/items/item-paths";
import { apiGet } from "@/lib/api-client";
import { formatQuantity } from "@/lib/format";
import type { ItemView } from "@/types/item-master";
import { ItemLotsTable } from "./item-lots-table";
import { ItemMonthsTable, ItemPartiesTable } from "./item-movement-tables";
import { ItemOverview } from "./item-overview";
import { ItemRateHistory } from "./item-rate-chart";
import { itemSummaryPath, type ItemSummaryView } from "./types";

// The item summary report (client, 13 Nov 2026): pick an item and see
// everything about it. The item sits in the address (?item=) so the stock
// summary can link to it and a page can be shared or reloaded.
export function ItemSummaryWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const itemId = params.get("item") ?? "";
  const items = useSWR<ItemView[]>(ITEMS_PATH, apiGet);
  const summary = useSWR<ItemSummaryView>(itemId ? itemSummaryPath(itemId) : null, apiGet);

  const options = useMemo(
    () =>
      (items.data ?? [])
        .toSorted((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name))
        .map((item) => ({
          value: item.id,
          label: item.sku ? `${item.name} · ${item.sku}` : item.name,
          detail: `${formatQuantity(item.stock)} in stock${item.isArchived ? " · archived" : ""}`,
        })),
    [items.data],
  );

  const pick = (id: string) => router.replace(`${pathname}?item=${encodeURIComponent(id)}`, { scroll: false });
  const data = summary.data && summary.data.item.id === itemId ? summary.data : undefined;

  return (
    <div className="flex flex-col gap-3.5">
      <GlassCard className="flex flex-wrap items-end gap-3 print:hidden">
        <ComboField
          label="Item"
          options={options}
          value={itemId}
          onChange={pick}
          placeholder={items.data ? "Type a name or SKU" : "Loading items…"}
          disabled={!items.data}
          className="min-w-[260px] flex-1"
        />
        {data && (
          <Button variant="neutral" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print
          </Button>
        )}
      </GlassCard>

      {!itemId ? (
        <GlassCard>
          <p className="text-sm font-medium text-muted">
            Pick an item to see its stock, every lot it came in as with the profit each has made, the rates it was bought, sold and listed at, and its full history.
          </p>
        </GlassCard>
      ) : !data ? (
        <GlassCard>
          <LoadNotice error={summary.error} what="the item summary" />
        </GlassCard>
      ) : (
        <>
          <ItemOverview data={data} />
          <ItemRateHistory rates={data.rates} unit={data.item.unit} />
          <ItemLotsTable lots={data.lots} unit={data.item.unit} />
          <ItemMonthsTable months={data.months} />
          <div className="grid gap-3.5 xl:grid-cols-2">
            <ItemPartiesTable title="Customers" rows={data.customers} side="customer" unit={data.item.unit} />
            <ItemPartiesTable title="Vendors" rows={data.vendors} side="vendor" unit={data.item.unit} />
          </div>
          <ItemHistory itemId={data.item.id} unit={data.item.unit} />
        </>
      )}
    </div>
  );
}
