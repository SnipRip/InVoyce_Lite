// An item as form values: the stored item, or a blank new one with a row per
// godown for opening stock. Shared by the item form and the quick-add dialog.
import type { ItemFormValues } from "./item-schema";
import type { Item } from "./types";
import { NONE } from "./use-overrides";

const text = (value: number | undefined) => (value === undefined ? "" : String(value));

export function toItemFormValues(item: Item | undefined, godowns: string[], currentHsn?: string): ItemFormValues {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    categoryId: item?.categoryId ?? "",
    subCategoryId: item?.subCategoryId ?? NONE,
    brand: item?.brand ?? NONE,
    description: item?.description ?? "",
    hsn: currentHsn ?? "",
    gstOverride: text(item?.overrides.gstRatePct),
    unitOverride: item?.overrides.unit ?? "",
    // Shown the natural way round: "1 bundle = 25 kg", not "1 kg = 0.04 bundle".
    alternateUnits: (item?.alternateUnits ?? []).map((conversion) => {
      const perBase = conversion.baseQuantity < 1;
      const quantity = perBase ? 1 / conversion.baseQuantity : conversion.baseQuantity;
      return { unit: conversion.unit, quantity: String(Number(quantity.toFixed(3))), perBase };
    }),
    reportingUnit: item?.reportingUnit ?? "",
    weightKg: text(item?.weightKg),
    mrp: text(item?.mrp),
    preferredSupplier: item?.preferredSupplier ?? "",
    openingStock: godowns.map((godown) => ({ godown, quantity: "" })),
    openingRate: "",
    reorderLevel: text(item?.reorderLevel),
  };
}
