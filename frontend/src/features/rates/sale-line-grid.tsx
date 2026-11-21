"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import { ComboField, type ComboOption } from "@/components/ui/combo-field";
import { LineGrid, type LineGridState } from "@/components/ui/line-grid";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import { describeComponents, type Regime } from "@/features/gst/gst-rules";
import { LineGstCell } from "@/features/gst/line-gst-cell";
import type { LineGstContext } from "@/features/gst/line-gst-rate";
import { LineUnitSelect } from "@/features/items/line-unit-select";
import { conversionText } from "@/features/items/line-units";
import { formatQuantity, formatRate } from "@/lib/format";
import { LineRatePicker } from "./line-rate-picker";
import type { PricedSaleLine, SaleLineInput, SaleLineRow } from "./sale-line-row";
import { useQuickAddItem } from "@/features/items/quick-add-item";

type LineField = "quantity" | "rate" | "discountPct" | "gstRatePct";

interface SaleLineGridProps {
  grid: LineGridState;
  rowKeys: string[];
  /** The lines as typed (watched). */
  lines: SaleLineInput[];
  rows: (SaleLineRow | undefined)[];
  priced: PricedSaleLine[];
  itemOptions: ComboOption[];
  gst: LineGstContext;
  regime: Regime;
  registerLine: (index: number, field: LineField) => UseFormRegisterReturn;
  errorOf: (index: number, field: keyof SaleLineInput) => string | undefined;
  onPickItem: (index: number, itemId: string) => void;
  onPickUnit: (index: number, unit: string, factor: number) => void;
  onPickRate: (index: number, rate: number) => void;
  /** Stock shown for the line: the godown's on an invoice, all godowns on a quotation. */
  stockOf: (row: SaleLineRow, priced?: PricedSaleLine) => { text: string; short: boolean };
}

const COLUMNS = "minmax(0,3fr) 88px minmax(72px,0.8fr) minmax(84px,0.9fr) 64px 64px minmax(96px,1fr)";
const HEADERS = [
  { label: "Item" },
  { label: "Unit" },
  { label: "Quantity", align: "right" as const },
  { label: "Rate ₹", align: "right" as const },
  { label: "Disc %", align: "right" as const },
  { label: "GST %", align: "right" as const },
  { label: "Amount ₹", align: "right" as const },
];

// The lines of a quotation or invoice: one compact row each, and under the
// table the focused line's rates offered, schemes, stock and GST split.
export function SaleLineGrid(props: SaleLineGridProps) {
  const { grid, rowKeys, lines, rows, priced, itemOptions, gst, regime, registerLine, errorOf, onPickItem, onPickUnit, onPickRate, stockOf } = props;
  const addItem = useQuickAddItem<number>(itemOptions.map((option) => option.value), (itemId, index) => onPickItem(index, itemId));
  const pricedOf = (index: number) => priced.find((candidate) => candidate.key === String(index));
  const active = rows[grid.active];
  const activePriced = pricedOf(grid.active);
  const typedRateOf = (index: number) => {
    const row = rows[index];
    return lines[index]?.rate && row ? row.rate * (1 - row.discountPct / 100) : undefined;
  };

  return (
    <>
    {addItem.dialog}
    <LineGrid
      grid={grid}
      rowKeys={rowKeys}
      label="Items"
      columns={COLUMNS}
      headers={HEADERS}
      addLabel="Add an item"
      renderRow={(index) => {
        const row = rows[index];
        const line = pricedOf(index);
        return (
          <>
            <ComboField
              label="Item"
              hideLabel
              options={itemOptions}
              value={lines[index]?.itemId ?? ""}
              onChange={(itemId) => onPickItem(index, itemId)}
              onEmptyEnter={() => grid.emptyEnter(index)}
              onAdd={() => addItem.open(index)}
              addLabel="Add a new item"
              error={errorOf(index, "itemId")}
              placeholder="Type an item name or SKU"
              inputProps={{ "data-line-start": true }}
            />
            <LineUnitSelect hideLabel choices={row?.choices ?? []} value={lines[index]?.unit ?? ""} onChange={(unit, factor) => onPickUnit(index, unit, factor)} />
            <TextField label="Quantity" hideLabel inputMode="decimal" className="text-right" error={errorOf(index, "quantity")} {...registerLine(index, "quantity")} />
            <TextField label="Rate" hideLabel inputMode="decimal" className="text-right" error={errorOf(index, "rate")} {...registerLine(index, "rate")} />
            <TextField label="Discount %" hideLabel inputMode="decimal" className="text-right" error={errorOf(index, "discountPct")} {...registerLine(index, "discountPct")} />
            <LineGstCell master={row?.hsnRatePct} context={gst} error={errorOf(index, "gstRatePct")} {...registerLine(index, "gstRatePct")} />
            <span className="flex h-[34px] items-center justify-end text-[13px] font-semibold tabular-nums">
              {line && line.schemeDiscount > 0 ? (
                <>
                  <span className="mr-1.5 text-xs text-muted line-through">{formatRate(line.gross)}</span>
                  {formatRate(line.taxable)}
                </>
              ) : row ? (
                formatRate(row.gross)
              ) : (
                ""
              )}
            </span>
          </>
        );
      }}
      detail={
        active ? (
          <div className="glass-inset flex flex-col gap-2 rounded-(--radius-tile) p-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
              <span className="text-ink">
                Line {grid.active + 1}: {active.item.name}
              </span>
              {(() => {
                const stock = stockOf(active, activePriced);
                return <span className={stock.short ? "text-danger-strong" : undefined}>{stock.text}</span>;
              })()}
              {active.factor !== 1 && (
                <span>
                  {conversionText(active.unit, active.factor, active.baseUnit)} · {formatQuantity(active.base.quantity)} {active.baseUnit}
                </span>
              )}
              <span>HSN {active.hsn || "not set"}</span>
              <span>
                GST {active.gstRatePct}% → {describeComponents(active.gstRatePct, regime)}
                {gst.applicable && !gst.enforce && active.hsnRatePct !== undefined && active.gstRatePct !== active.hsnRatePct && ` (HSN rate ${active.hsnRatePct}%)`}
              </span>
            </p>
            {active.options && <LineRatePicker options={active.options} rate={typedRateOf(grid.active)} onPick={(rate) => onPickRate(grid.active, rate)} />}
            {activePriced && activePriced.applied.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {activePriced.applied.map((applied) => (
                  <li key={applied.schemeId}>
                    <StatusChip tone="success">
                      {applied.name}: {applied.freeQuantity ? `+${formatQuantity(applied.freeQuantity)} ${active.baseUnit} free` : `− ${formatRate(applied.amount)}`}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="glass-inset rounded-(--radius-tile) p-3 text-xs font-semibold text-muted">
            Pick an item: its stock, HSN, GST and the rates on offer show here. Enter on a blank line moves on.
          </p>
        )
      }
    />
    </>
  );
}
