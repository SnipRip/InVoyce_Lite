"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { mutate } from "swr";
import { SelectField } from "@/components/ui/select-field";
import { StepDialog } from "@/components/ui/step-dialog";
import { TextField } from "@/components/ui/text-field";
import { usePickWhenListed } from "@/lib/use-pick-when-listed";
import type { ItemView } from "@/types/item-master";
import { formOptions, saveItem, useItemMasters, type ItemMasters } from "./catalog-api";
import { toItemFormValues } from "./item-form-values";
import { ITEMS_PATH } from "./item-paths";
import { GST_RATES, resolveDefaults } from "./item-rules";
import { itemSchema, type ItemFormValues } from "./item-schema";
import { suggestItemSku } from "./sku-rules";
import { NONE, type Overridable } from "./use-overrides";

type Field = FieldPath<ItemFormValues>;

const STEP_FIELDS: Field[][] = [
  ["name", "categoryId", "subCategoryId", "brand", "hsn", "unitOverride", "gstOverride"],
  ["mrp", "reorderLevel", "openingStock", "openingRate", "sku"],
];

/** "As the category says" in the unit and GST pickers (a select option cannot be blank). */
const INHERITED = "__inherited";
const fullWidth = "sm:col-span-2";

/** Item lists are cached under keys starting with /items. */
export const reloadItems = () => mutate((key) => typeof key === "string" && key.startsWith(ITEMS_PATH));

interface QuickAddItemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gets the saved item once the lists have reloaded. */
  onCreated: (item: ItemView) => void;
}

// A new item from the "+" beside an item picker on any voucher. Two short
// steps; units in other measures and the description stay on the
// item's own page.
export function QuickAddItemDialog(props: QuickAddItemProps) {
  const { masters } = useItemMasters();
  // The masters load once and are shared through SWR; the form waits for them.
  if (!masters) return null;
  return <QuickAddItemForm masters={masters} {...props} />;
}

function QuickAddItemForm({ masters, open, onOpenChange, onCreated }: QuickAddItemProps & { masters: ItemMasters }) {
  const { brands, units, godowns } = formOptions(masters);
  const blank = () => toItemFormValues(undefined, godowns);
  const {
    register,
    control,
    setValue,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: blank(),
  });
  const [name, categoryId, subCategoryId, brand, hsn, unitOverride, gstOverride] = useWatch({
    control,
    name: ["name", "categoryId", "subCategoryId", "brand", "hsn", "unitOverride", "gstOverride"],
  });
  const [hsnTouched, setHsnTouched] = useState(false);

  const { catalog } = masters;
  const category = catalog.categories.find((candidate) => candidate.id === categoryId);
  const place = {
    categoryId,
    subCategoryId: subCategoryId === NONE ? undefined : subCategoryId,
  };
  const inherited = resolveDefaults(catalog, place, { hsn: hsn || undefined });
  const suggestedHsn = resolveDefaults(catalog, place).hsn.value;

  // The category's HSN fills in until one is typed.
  const pickPlace = (field: "categoryId" | "subCategoryId", value: string) => {
    setValue(field, value, { shouldValidate: true });
    if (field === "categoryId") setValue("subCategoryId", NONE);
    if (!hsnTouched) {
      const next = resolveDefaults(catalog, {
        categoryId: field === "categoryId" ? value : categoryId,
        subCategoryId: field === "subCategoryId" && value !== NONE ? value : undefined,
      }).hsn.value;
      setValue("hsn", next ?? "");
    }
  };

  const changeOpen = (next: boolean) => {
    if (!next) {
      reset(blank());
      setHsnTouched(false);
    }
    onOpenChange(next);
  };

  const save = async () => {
    const values = getValues();
    const overridden = new Set<Overridable>();
    if (values.unitOverride) overridden.add("unit");
    if (values.gstOverride) overridden.add("gstRatePct");
    const saved = await saveItem(masters, undefined, values, overridden);
    await reloadItems();
    onCreated(saved);
    reset(blank());
    setHsnTouched(false);
  };

  const taken = new Set(catalog.items.map((item) => item.sku).filter((sku): sku is string => Boolean(sku)));
  // The unit picked here, else the one the category gives.
  const unitLabel = unitOverride || inherited.unit.value || "unit";

  const basics: ReactNode = (
    <>
      <div className={fullWidth}>
        <TextField label="Item name" placeholder="TMT Bar 12 mm Fe 550D" autoFocus error={errors.name?.message} {...register("name")} />
      </div>
      <div className="flex flex-col gap-1">
        <SelectField
          label="Category"
          options={catalog.categories.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
          }))}
          value={categoryId || undefined}
          onValueChange={(value) => pickPlace("categoryId", value)}
        />
        {errors.categoryId && <p className="text-xs font-semibold text-danger-strong">{errors.categoryId.message}</p>}
      </div>
      <SelectField
        label="Sub-category"
        options={[
          { value: NONE, label: "None" },
          ...(category?.subCategories ?? []).map((sub) => ({
            value: sub.id,
            label: sub.name,
          })),
        ]}
        value={subCategoryId}
        onValueChange={(value) => pickPlace("subCategoryId", value)}
        disabled={!category || category.subCategories.length === 0}
      />
      <Controller
        control={control}
        name="brand"
        render={({ field }) => (
          <SelectField
            label="Brand"
            options={[{ value: NONE, label: "No brand" }, ...brands.map((value) => ({ value, label: value }))]}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
      <TextField
        label="HSN code"
        inputMode="numeric"
        maxLength={8}
        hint={suggestedHsn && hsn !== suggestedHsn ? `Category suggests ${suggestedHsn}` : "4, 6 or 8 digits; exports need 8"}
        error={errors.hsn?.message}
        {...register("hsn", { onChange: () => setHsnTouched(true) })}
      />
      <SelectField
        label="Unit (stock is counted in this)"
        options={[
          {
            value: INHERITED,
            label: inherited.unit.value ? `${inherited.unit.value} · from the category` : "Pick a unit",
          },
          ...units.map((value) => ({ value, label: value })),
        ]}
        value={unitOverride || INHERITED}
        onValueChange={(value) => setValue("unitOverride", value === INHERITED ? "" : value)}
      />
      <SelectField
        label="GST rate"
        options={[
          {
            value: INHERITED,
            label:
              inherited.gstRatePct.value !== undefined
                ? `${inherited.gstRatePct.value}% · from the ${inherited.gstRatePct.source === "hsn" ? "HSN code" : "category"}`
                : "Pick a rate",
          },
          ...GST_RATES.map((rate) => ({
            value: String(rate),
            label: `${rate}%`,
          })),
        ]}
        value={gstOverride || INHERITED}
        onValueChange={(value) => setValue("gstOverride", value === INHERITED ? "" : value)}
      />
    </>
  );

  const stock: ReactNode = (
    <>
      <TextField label="MRP (₹)" inputMode="decimal" hint="Blank if it has none" error={errors.mrp?.message} {...register("mrp")} />
      <TextField
        label={`Reorder level (${unitLabel})`}
        inputMode="decimal"
        hint="Warns when stock falls to it"
        error={errors.reorderLevel?.message}
        {...register("reorderLevel")}
      />
      {godowns.map((godown, index) => (
        <TextField
          key={godown}
          label={godowns.length > 1 ? `Opening stock in ${godown} (${unitLabel})` : `Opening stock (${unitLabel})`}
          inputMode="decimal"
          error={errors.openingStock?.[index]?.quantity?.message}
          {...register(`openingStock.${index}.quantity`)}
        />
      ))}
      <TextField
        label={`Opening rate (₹ per ${unitLabel})`}
        inputMode="decimal"
        hint="What the opening stock cost"
        error={errors.openingRate?.message}
        {...register("openingRate")}
      />
      <div className={fullWidth}>
        <TextField
          label="SKU (optional)"
          error={errors.sku?.message}
          trailing={
            <button
              type="button"
              aria-label="Make a SKU from the name"
              onClick={() =>
                setValue(
                  "sku",
                  suggestItemSku(
                    {
                      name,
                      category: category?.name,
                      brand: brand === NONE ? undefined : brand,
                    },
                    taken,
                  ),
                  { shouldValidate: true },
                )
              }
              className="mr-1 flex h-[26px] items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-brand-strong hover:bg-brand-tint"
            >
              <Wand2 aria-hidden="true" className="size-3.5" />
              Make
            </button>
          }
          {...register("sku")}
        />
      </div>
      <p className={`${fullWidth} text-xs font-medium text-muted`}>Other units and the description can be added later on the item&rsquo;s page.</p>
    </>
  );

  return (
    <StepDialog
      open={open}
      onOpenChange={changeOpen}
      title="New item"
      description="Saved to the item list and picked here."
      steps={[
        { title: "Item", content: basics },
        { title: "Stock & price", content: stock },
      ]}
      validateStep={(index) => trigger(STEP_FIELDS[index])}
      onSave={save}
      saveLabel="Save item"
    />
  );
}

/**
 * An item picker's "+": its dialog, and the function that opens it with the
 * place to put the new item (a line's index). The item goes to `onPick` once
 * `listedIds` (the picker's own list) holds it.
 */
export function useQuickAddItem<T = null>(listedIds: readonly string[], onPick: (id: string, context: T) => void) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<T | null>(null);
  const pickLater = usePickWhenListed<T>(listedIds, onPick);
  const onCreated = (item: ItemView) => pickLater(item.id, context as T);
  return {
    open: (target: T) => {
      setContext(target);
      setOpen(true);
    },
    // Mounted only while open: the item masters load when the "+" is pressed, not with every form.
    dialog: open ? <QuickAddItemDialog open onOpenChange={setOpen} onCreated={onCreated} /> : null,
  };
}
