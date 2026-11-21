// One quotation or invoice line as the form works with it: the item, its
// HSN and GST, the unit the line is in (any of the item's units) and the
// same line in base units for stock and schemes, and the rate options
// re-stated per the line's unit. Shared by both sale forms. No React.
import { resolveItemDefaults, type ItemCatalog } from "@/features/items/item-rules";
import { effectiveGstRate, type LineGstContext } from "@/features/gst/line-gst-rate";
import { inBaseUnits, unitChoices, unitFactor } from "@/features/items/line-units";
import type { AppliedSchemeView, SchemeResultView } from "@/types/scheme";
import { scaleRateOptions, schemeRateSource, type LineRateOptions } from "./line-rate-options";

/** A line as the form holds it: numbers as typed text, unit blank for the base. */
export interface SaleLineInput {
  itemId: string;
  unit: string;
  quantity: string;
  rate: string;
  discountPct: string;
  /** GST % as typed; "" = the item's HSN rate (line-gst-rate.ts). */
  gstRatePct: string;
}

export const EMPTY_SALE_LINE: SaleLineInput = { itemId: "", unit: "", quantity: "", rate: "", discountPct: "", gstRatePct: "" };

const ANY_RATE: LineGstContext = { enforce: false, applicable: true };

export function saleLineRow(catalog: ItemCatalog, line: SaleLineInput | undefined, index: number, optionsOf: Map<string, LineRateOptions>, gst = ANY_RATE) {
  const item = catalog.items.find((candidate) => candidate.id === line?.itemId);
  if (!item || !line) return undefined;
  const defaults = resolveItemDefaults(catalog, item);
  const baseUnit = defaults.unit.value ?? "";
  const choices = unitChoices(item, baseUnit);
  const choice = choices.find((candidate) => candidate.unit === line.unit) ?? choices[0];
  const quantity = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  const discountPct = Number(line.discountPct) || 0;
  const baseOptions = optionsOf.get(item.id);
  // Rates are offered per base unit; the line sees them per its own unit.
  const options = baseOptions && scaleRateOptions(baseOptions, choice.factor);
  return {
    key: String(index),
    item,
    hsn: defaults.hsn.value ?? "",
    unit: choice.unit,
    baseUnit,
    factor: choice.factor,
    choices,
    /** What schemes and stock see. */
    base: inBaseUnits(quantity, rate, choice.factor),
    /** The item's HSN / SAC rate; undefined when it has none. */
    hsnRatePct: defaults.gstRatePct.value ?? undefined,
    gstRatePct: effectiveGstRate(defaults.gstRatePct.value ?? undefined, line.gstRatePct ?? "", gst),
    quantity,
    rate,
    discountPct,
    gross: Math.round(quantity * rate * (1 - discountPct / 100) * 100) / 100,
    options,
    rateSource: schemeRateSource(rate, options),
  };
}

/** Base units in one of the line's unit (1 before an item is picked). */
export function saleLineFactor(catalog: ItemCatalog, line: Pick<SaleLineInput, "itemId" | "unit"> | undefined): number {
  const item = catalog.items.find((candidate) => candidate.id === line?.itemId);
  return item ? unitFactor(item, resolveItemDefaults(catalog, item).unit.value ?? "", line?.unit) : 1;
}

export type SaleLineRow = NonNullable<ReturnType<typeof saleLineRow>>;

/** A line with what the schemes in force did to it. */
export type PricedSaleLine = SaleLineRow & { taxable: number; schemeDiscount: number; freeQuantity: number; applied: AppliedSchemeView[] };

/**
 * Each priced line with its scheme result, trusted only for this exact line:
 * while typing (the schemes call is debounced) the line's own value stands.
 */
export function withSchemes(rows: SaleLineRow[], schemes: SchemeResultView | undefined): PricedSaleLine[] {
  return rows.map((row) => {
    const scheme = schemes?.lines.find((line) => line.key === row.key);
    const current = scheme && Math.abs(scheme.gross - row.gross) < 0.005 ? scheme : undefined;
    return { ...row, taxable: current?.taxable ?? row.gross, schemeDiscount: current?.schemeDiscount ?? 0, freeQuantity: current?.freeQuantity ?? 0, applied: current?.applied ?? [] };
  });
}

/** What the schemes call is asked: priced lines per base unit, as on save. */
export const schemeRequest = (rows: SaleLineRow[]) =>
  JSON.stringify(rows.map((row) => ({ key: row.key, itemId: row.item.id, quantity: row.base.quantity, rate: row.base.rate, discountPct: row.discountPct, rateSource: row.rateSource })));
