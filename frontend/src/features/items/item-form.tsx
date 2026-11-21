"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, Plus, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { firstStepWithErrors, stepHasErrors } from "@/lib/step-errors";
import { SelectField } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import { Tooltip } from "@/components/ui/tooltip";
import { HsnSummary } from "@/features/hsn/hsn-summary";
import { ApiError } from "@/lib/api-client";
import { formatRate } from "@/lib/format";
import { InheritedField } from "./inherited-field";
import { TodaysRateField } from "./todays-rate-field";
import { findGroup, resolveDefaults, resolveItemDefaults, type ItemCatalog } from "./item-rules";
import { itemSchema, type ItemFormValues } from "./item-schema";
import { suggestItemSku } from "./sku-rules";
import type { Item } from "./types";
import { toItemFormValues } from "./item-form-values";
import { NONE, OVERRIDE_FIELD, useOverrides, type Overridable } from "./use-overrides";

export interface ItemFormOptions {
  brands: string[];
  units: string[];
  godowns: string[];
  gstRates: number[];
}

interface ItemFormProps extends ItemFormOptions {
  catalog: ItemCatalog;
  /** The item being edited; a new item when absent. */
  item?: Item;
  /** Saves through the backend; throws an ApiError the form shows. */
  onSave: (values: ItemFormValues, overridden: ReadonlySet<Overridable>) => Promise<void>;
}

export const saveErrorText = (error: unknown) =>
  error instanceof ApiError ? error.message : "Could not save. Check the connection and try again.";

/** Select value for "the base unit" (a select option cannot be blank). */
const BASE_UNIT = "__base__";

/** The fields on each step, to mark a step red and open it on a failed save. */
const STEP_FIELDS = [["name", "sku", "categoryId", "subCategoryId", "brand", "description"], ["unitOverride", "alternateUnits", "weightKg", "hsn", "gstOverride"], ["mrp", "preferredSupplier", "openingStock", "openingRate", "reorderLevel"]] as const;

// The item form, in this order: basics, units, tax, sales, purchase,
// inventory. HSN, GST rate and unit are inherited from the category tree and
// only stored on the item when it is changed here.
export function ItemForm({ catalog, item, brands, units, godowns, gstRates, onSave }: ItemFormProps) {
  const isNew = !item;
  const group = findGroup(catalog, item?.groupId);
  const overrides = useOverrides(item?.overrides);
  const { overridden } = overrides;
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [step, setStep] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema), defaultValues: toItemFormValues(item, godowns, item && resolveItemDefaults(catalog, item).hsn.value) });
  const alternateUnits = useFieldArray({ control, name: "alternateUnits" });

  const [categoryId, subCategoryId, unitOverride, conversions, hsn, name, brand, reportingUnit] = useWatch({
    control,
    name: ["categoryId", "subCategoryId", "unitOverride", "alternateUnits", "hsn", "name", "brand", "reportingUnit"],
  });
  const category = catalog.categories.find((candidate) => candidate.id === categoryId);
  const place = { categoryId, subCategoryId: subCategoryId === NONE ? undefined : subCategoryId, groupId: item?.groupId };
  // What this item would get from above if it set nothing itself.
  // A changed HSN still counts, so the GST rate follows it from the master.
  // GST follows the HSN typed on this item; the category's HSN is only a suggestion.
  const suggestedHsn = resolveDefaults(catalog, place).hsn.value;
  const inherited = resolveDefaults(catalog, place, { hsn: hsn || undefined });
  const baseUnit = (overridden.has("unit") && unitOverride) || inherited.unit.value || "unit";

  // HSN is the item's own field here, so only GST rate and unit are overrides.
  const override = (key: Exclude<Overridable, "hsn">) => {
    overrides.add(key);
    setValue(OVERRIDE_FIELD[key], String(inherited[key].value ?? ""), { shouldDirty: true });
  };
  const resetOverride = (key: Exclude<Overridable, "hsn">) => {
    overrides.remove(key);
    setValue(OVERRIDE_FIELD[key], "", { shouldDirty: true });
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setResult(null);
      try {
        await onSave(values, overridden);
        // The saved values become the new starting point for "Discard changes".
        reset(values);
        setResult({ tone: "success", text: `${values.name} saved.` });
      } catch (error) {
        setResult({ tone: "error", text: saveErrorText(error) });
      }
    },
    (failed) => {
      setStep(firstStepWithErrors(failed, STEP_FIELDS));
      setResult({ tone: "error", text: "Some fields need attention. The step marked red has them." });
    },
  );

  // From category, brand and name, numbered when another item has it.
  const generateSku = () => {
    const taken = new Set(catalog.items.filter((other) => other.id !== item?.id && other.sku).map((other) => other.sku!.toUpperCase()));
    setValue("sku", suggestItemSku({ name: name ?? "", category: category?.name, brand: brand === NONE ? undefined : brand }, taken), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const categoryOptions = catalog.categories.map((candidate) => ({ value: candidate.id, label: candidate.name }));
  const subCategoryOptions = [
    { value: NONE, label: category?.subCategories.length ? "None" : "No sub-categories" },
    ...(category?.subCategories ?? []).map((sub) => ({ value: sub.id, label: sub.name })),
  ];
  const unitOptions = units.map((unit) => ({ value: unit, label: unit }));
  // The form keeps "" for the base unit, whatever it ends up being.
  const reportingOptions = [
    { value: BASE_UNIT, label: `${baseUnit} (base unit)` },
    ...(conversions ?? []).filter((row) => row.unit && row.unit !== baseUnit).map((row) => ({ value: row.unit, label: row.unit })),
  ];

  // Three steps that each fit the screen, worked like a voucher (client, 13 Nov 2026).
  return (
    <form onSubmit={onSubmit} noValidate>
      <VoucherSteps
        heading={
          <>
            <CardTitle>{isNew ? "New item" : (item.name ?? "Item")}</CardTitle>
            {group && (
              <StatusChip tone="brand">
                Variant of{" "}
                <Link href={`/items/groups/${group.id}`} className="underline">
                  {group.name}
                </Link>
              </StatusChip>
            )}
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void onSubmit()}
        steps={[
          {
            id: "basics",
            title: "Basics",
            summary: name || undefined,
            invalid: stepHasErrors(errors, STEP_FIELDS[0]),
            content: (
              <>
                <div className="grid gap-3.5 @xl:grid-cols-2">
                  <TextField label="Item name" placeholder="TMT Bar Fe 600 12 mm" error={errors.name?.message} {...register("name")} />
                  <TextField
                    label="SKU / code (optional)"
                    placeholder="Leave blank, or generate one"
                    error={errors.sku?.message}
                    className="pr-24"
                    trailing={
                      <button
                        type="button"
                        onClick={generateSku}
                        disabled={!name?.trim()}
                        className="mr-1 inline-flex h-[26px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-brand-strong hover:bg-brand/10 disabled:text-muted disabled:hover:bg-transparent"
                      >
                        <Wand2 aria-hidden="true" className="size-3.5" />
                        Generate
                      </button>
                    }
                    {...register("sku")}
                  />
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1.5">
                        <SelectField
                          label={group ? "Category · set by the item group" : "Category"}
                          options={categoryOptions}
                          value={field.value || undefined}
                          onValueChange={(value) => {
                            field.onChange(value);
                            setValue("subCategoryId", NONE);
                          }}
                          disabled={Boolean(group)}
                        />
                        {errors.categoryId && <p className="text-xs font-semibold text-danger-strong">{errors.categoryId.message}</p>}
                      </div>
                    )}
                  />
                  <Controller
                    control={control}
                    name="subCategoryId"
                    render={({ field }) => (
                      <SelectField
                        label={group ? "Sub-category · set by the item group" : "Sub-category"}
                        options={subCategoryOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={Boolean(group) || !category || category.subCategories.length === 0}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="brand"
                    render={({ field }) => (
                      <SelectField
                        label="Brand"
                        options={[{ value: NONE, label: "No brand" }, ...brands.map((brand) => ({ value: brand, label: brand }))]}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                  <TextField label="Description" placeholder="Grade, make, length" error={errors.description?.message} {...register("description")} />
                </div>
                {group && item?.attributeValues && (
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                    Attributes:
                    {Object.entries(item.attributeValues).map(([name, value]) => (
                      <StatusChip key={name} tone="neutral">
                        {name}: {value}
                      </StatusChip>
                    ))}
                  </div>
                )}
              </>
            ),
          },
          {
            id: "units",
            title: "Units & tax",
            invalid: stepHasErrors(errors, STEP_FIELDS[1]),
            content: (
              <div className="grid items-start gap-x-6 gap-y-3.5 @4xl:grid-cols-2">
                <section className="flex flex-col gap-3.5">
                  <CardTitle>Units</CardTitle>
                  <InheritedField
                    label="Base unit (stock is counted in this)"
                    inherited={inherited.unit}
                    overridden={overridden.has("unit")}
                    onOverride={() => override("unit")}
                    onReset={() => resetOverride("unit")}
                  >
                    <Controller
                      control={control}
                      name="unitOverride"
                      render={({ field }) => (
                        <SelectField label="Base unit (stock is counted in this)" options={unitOptions} value={field.value || undefined} onValueChange={field.onChange} />
                      )}
                    />
                  </InheritedField>

                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-medium text-muted">Other units this item is bought or sold in</span>
                    {alternateUnits.fields.map((field, index) => {
                      const row = conversions?.[index];
                      const unitPicker = (
                        <Controller
                          control={control}
                          name={`alternateUnits.${index}.unit`}
                          render={({ field: unitField }) => (
                            <SelectField
                              label={row?.perBase ? "of this unit" : "1 of this unit"}
                              options={unitOptions}
                              value={unitField.value || undefined}
                              onValueChange={unitField.onChange}
                            />
                          )}
                        />
                      );
                      const quantityField = (
                        <TextField
                          label={row?.perBase ? `1 ${baseUnit} =` : `= how many ${baseUnit}`}
                          inputMode="decimal"
                          error={errors.alternateUnits?.[index]?.quantity?.message}
                          {...register(`alternateUnits.${index}.quantity`)}
                        />
                      );
                      return (
                        <div key={field.id} className="flex flex-col gap-1">
                          <div className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2">
                            {row?.perBase ? quantityField : unitPicker}
                            {row?.perBase ? unitPicker : quantityField}
                            <Tooltip label="Swap which side is 1">
                              <Button
                                variant="neutral"
                                aria-label="Swap which side is 1"
                                onClick={() => setValue(`alternateUnits.${index}.perBase`, !row?.perBase, { shouldDirty: true })}
                                className="w-11 px-0"
                              >
                                <ArrowLeftRight aria-hidden="true" className="size-[18px]" />
                              </Button>
                            </Tooltip>
                            <Button variant="neutral" aria-label="Remove this unit" onClick={() => alternateUnits.remove(index)} className="w-11 px-0">
                              <Trash2 aria-hidden="true" className="size-[18px]" />
                            </Button>
                          </div>
                          {row?.unit && Number(row.quantity) > 0 && (
                            <p className="pl-1 text-xs font-semibold text-brand-strong">
                              {row.perBase ? `1 ${baseUnit} = ${row.quantity} ${row.unit}` : `1 ${row.unit} = ${row.quantity} ${baseUnit}`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      onClick={() => alternateUnits.append({ unit: "", quantity: "", perBase: false })}
                      className="self-start"
                    >
                      <Plus aria-hidden="true" className="size-[18px]" />
                      Add a unit
                    </Button>
                    {alternateUnits.fields.length > 0 && (
                      <p className="text-xs text-muted">
                        Bills, quotations and invoices can take any of these units. Stock and cost stay in {baseUnit}.
                      </p>
                    )}
                  </div>

                  {reportingOptions.length > 1 && (
                    <div className="flex flex-col gap-1">
                      <SelectField
                        label="Unit for GST returns (reporting UQC)"
                        options={reportingOptions}
                        value={reportingOptions.some((option) => option.value === reportingUnit) ? reportingUnit : BASE_UNIT}
                        onValueChange={(value) => setValue("reportingUnit", value === BASE_UNIT ? "" : value, { shouldDirty: true })}
                      />
                      <p className="text-[11.5px] font-medium text-muted">The GSTR-1 HSN summary shows this item&apos;s quantity in this unit</p>
                    </div>
                  )}

                  <TextField
                    label={`Weight per ${baseUnit} (kg)`}
                    inputMode="decimal"
                    hint="Used for truck load and e-way bill weight"
                    error={errors.weightKg?.message}
                    {...register("weightKg")}
                  />
                </section>

                <section className="flex flex-col gap-3.5">
                  <CardTitle>Tax</CardTitle>
                  <div className="flex flex-col gap-1.5">
                    <TextField
                      label="HSN code of this item"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="8 digits for exports"
                      error={errors.hsn?.message}
                      {...register("hsn")}
                    />
                    {suggestedHsn && suggestedHsn !== hsn && (
                      <button
                        type="button"
                        onClick={() => setValue("hsn", suggestedHsn, { shouldDirty: true, shouldValidate: true })}
                        className="self-start text-xs font-semibold text-brand hover:underline"
                      >
                        Use {suggestedHsn}, suggested by the sub-category
                      </button>
                    )}
                  </div>
                  <InheritedField
                    label="GST rate"
                    inherited={inherited.gstRatePct}
                    format={(value) => `${value}%`}
                    overridden={overridden.has("gstRatePct")}
                    onOverride={() => override("gstRatePct")}
                    onReset={() => resetOverride("gstRatePct")}
                  >
                    <Controller
                      control={control}
                      name="gstOverride"
                      render={({ field }) => (
                        <SelectField
                          label="GST rate"
                          options={gstRates.map((rate) => ({ value: String(rate), label: `${rate}%` }))}
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                        />
                      )}
                    />
                  </InheritedField>
                  {catalog.hsnCodes && <HsnSummary codes={catalog.hsnCodes} code={hsn || undefined} />}
                  <p className="text-xs font-semibold text-muted">
                    CGST + SGST or IGST is decided on each invoice from the place of supply.
                  </p>
                </section>
              </div>
            ),
          },
          {
            id: "stock",
            title: "Prices & stock",
            invalid: stepHasErrors(errors, STEP_FIELDS[2]),
            content: (
              <>
                <div className="grid items-start gap-x-6 gap-y-3.5 @4xl:grid-cols-2">
                  <section className="flex flex-col gap-3.5">
                    <CardTitle>Sales</CardTitle>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
                      <TextField label="MRP (₹)" inputMode="decimal" hint="As printed on the goods" error={errors.mrp?.message} {...register("mrp")} />
                      {!isNew && <TodaysRateField itemId={item.id} unit={baseUnit} />}
                    </div>
                    <p className="text-xs font-semibold text-muted">
                      The item has no fixed selling price: the day&rsquo;s rate comes from the{" "}
                      <Link href="/price-list" className="text-brand hover:underline">
                        rate sheet
                      </Link>
                      , and a customer&rsquo;s special rate (Rates) comes before it. Prices are before GST.
                    </p>
                  </section>

                  <section className="flex flex-col gap-3.5">
                    <CardTitle>Purchase</CardTitle>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
                      {!isNew && (
                        <>
                          <TextField label={`Last landed cost per ${baseUnit}`} value={costText(item.lastLandedCost)} disabled readOnly />
                          <TextField label={`Stock cost per ${baseUnit} (FIFO)`} value={costText(item.stockCost)} disabled readOnly />
                        </>
                      )}
                      <TextField label="Preferred supplier" placeholder="Hind Steel, Durgapur" error={errors.preferredSupplier?.message} {...register("preferredSupplier")} />
                    </div>
                    <p className="text-xs font-semibold text-muted">
                      Cost is not entered here. Each purchase is its own batch: the bill rate plus its share of freight, unloading and GST
                      that cannot be claimed. Stock is valued batch by batch, first in, first out.
                    </p>
                  </section>
                </div>

                <section className="flex flex-col gap-3.5 border-t border-line pt-3.5">
                  <CardTitle>Inventory</CardTitle>
                  <div className="grid gap-3.5 @2xl:grid-cols-3">
                    {isNew ? (
                      [...godowns.map((godown, index) => (
                        <TextField
                          key={godown}
                          label={`Opening stock · ${godown} (${baseUnit})`}
                          inputMode="decimal"
                          placeholder="0"
                          error={errors.openingStock?.[index]?.quantity?.message}
                          {...register(`openingStock.${index}.quantity`)}
                        />
                      )),
                      <TextField
                        key="opening-rate"
                        label={`Opening rate per ${baseUnit} (₹)`}
                        inputMode="decimal"
                        hint="Landed cost of the opening stock"
                        error={errors.openingRate?.message}
                        {...register("openingRate")}
                      />]
                    ) : (
                      <TextField label={`In stock (${baseUnit})`} value={item.stock} disabled readOnly hint="Changes through purchases, sales and stock adjustments" />
                    )}
                    <TextField
                      label={`Reorder level (${baseUnit})`}
                      inputMode="decimal"
                      hint="Flagged as low stock at or below this"
                      error={errors.reorderLevel?.message}
                      {...register("reorderLevel")}
                    />
                  </div>
                </section>
                {result && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
              </>
            ),
          },
        ]}
        actions={
          <>
            <Link href="/items" className={buttonClasses("neutral")} tabIndex={-1}>
              Back to items
            </Link>
            <Button
              variant="neutral"
              disabled={!isDirty}
              tabIndex={-1}
              onClick={() => {
                reset();
                setResult(null);
                overrides.restore();
              }}
            >
              Discard changes
            </Button>
            <Button type="submit" disabled={isSubmitting} data-voucher-accept="">
              {isSubmitting ? "Saving…" : isNew ? "Save item" : "Save changes"}
            </Button>
          </>
        }
      />
    </form>
  );
}

const costText = (cost: number | undefined) => (cost === undefined ? "No stock yet" : formatRate(cost));
