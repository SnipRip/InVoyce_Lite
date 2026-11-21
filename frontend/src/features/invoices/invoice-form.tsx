"use client";

import { billedAs, billingOptions, branchIdOf, deliveryOptions, findBranch, MAIN_BRANCH } from "@/features/parties/party-branches";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import useSWR from "swr";
import { useDebounceValue } from "usehooks-ts";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { useLineGrid } from "@/components/ui/line-grid";
import { SelectField } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { GstApplicableToggle } from "@/features/gst/gst-applicable-toggle";
import { chargesGst } from "@/features/gst/gst-rules";
import { INDIAN_STATES, stateName } from "@/features/gst/indian-states";
import { gstRateToSend, withoutGst, type LineGstContext } from "@/features/gst/line-gst-rate";
import { hsnRateText, itemLabel, type ItemCatalog } from "@/features/items/item-rules";
import { itemsInStock, stockIn } from "@/features/items/item-stock";
import { ratePerUnit, restateRate } from "@/features/items/line-units";
import { PICKED_VEHICLE_HINT, useLiveVehicles, VehicleSelect } from "@/features/masters/vehicle-picker";
import { placeOf } from "@/features/parties/party-rules";
import type { Party } from "@/features/parties/types";
import { previewTotals } from "@/features/quotations/quotation-rules";
import { toLineRateOptions, type LineRateOptions } from "@/features/rates/line-rate-options";
import { SaleLineGrid } from "@/features/rates/sale-line-grid";
import { EMPTY_SALE_LINE, saleLineFactor, saleLineRow, schemeRequest, withSchemes, type SaleLineRow } from "@/features/rates/sale-line-row";
import { fetchLineOptions, LINE_OPTIONS_PATH } from "@/features/rates/rates-api";
import { EVALUATE_SCHEMES_PATH, fetchSchemeResult } from "@/features/schemes/schemes-api";
import { lutFor } from "@/features/tax-export/lut-rules";
import type { Lut } from "@/features/tax-export/types";
import { apiGet, ApiError } from "@/lib/api-client";
import { formatDate, formatQuantity } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { GodownView } from "@/types/item-master";
import type { VehicleView } from "@/types/vehicle";
import { exportDeclaration, invoiceTax } from "./invoice-rules";
import { invoiceSchema, type InvoiceFormValues } from "./invoice-schema";
import { InvoiceTotalsCard } from "./invoice-totals-card";
import { createInvoice, numberPreviewPath, type InvoiceBody } from "./invoices-api";
import type { InvoiceKind } from "./types";
import type { OurRegistration } from "@/types/company";
import { useQuickAddParty } from "@/features/parties/quick-add-party";
import { GODOWN_BLANK, GODOWN_FIELDS } from "@/features/masters/godowns-master";
import { GODOWNS_PATH, godownPersistence } from "@/features/masters/masters-api";
import { useQuickAddRecord } from "@/features/masters/quick-add-record";

interface InvoiceFormProps {
  kind: InvoiceKind;
  customers: Party[];
  catalog: ItemCatalog;
  /** Active godowns; the goods leave from one, and its stock is drawn. */
  godowns: GodownView[];
  luts: Lut[];
  company: OurRegistration;
  /** Sales setting: the item picker lists only items with stock in the chosen godown. */
  inStockOnly: boolean;
  /** Converting a quotation: its customer and lines; it is marked converted on save. */
  fromQuotation?: {
    /** The quotation converted; absent when billing a challan made without one. */
    id?: string;
    /** The delivery challan billed: its goods, marked invoiced on save. */
    challanId?: string;
    label: string;
    partyId: string;
    /** The branch it was quoted to; billed there too. */
    billToBranchId?: string;
    gstApplicable: boolean;
    /** A challan's godown: the goods already left it. */
    godownId?: string;
    /** No GST % (a challan without a quotation): the item's HSN rate. */
    lines: { itemId: string; unit?: string; quantity: number; rate: number; discountPct: number; gstRatePct?: number }[];
  };
  onSaved: () => Promise<void>;
}

const KIND_TEXT: Record<InvoiceKind, { title: string; hint: string }> = {
  local: { title: "Local tax invoice", hint: "For buyers in India. GST is CGST + SGST inside our state, IGST for other states." },
  export: { title: "Export invoice", hint: "For buyers in Bhutan and abroad. Under LUT it carries no GST and quotes the LUT number." },
};

const emptyLine = EMPTY_SALE_LINE;

/** The step each field is on, to open the first step with an error. */
const stepOfErrors = (errors: FieldErrors<InvoiceFormValues>) =>
  errors.number || errors.date || errors.partyId || errors.godownId || errors.placeOfSupply ? 0 : errors.lines ? 1 : 2;

// The bill, in three steps that each fit the screen: buyer, items,
// delivery. Its kind is picked before this opens: a local GST tax invoice or
// an export invoice. Picking an item fills the customer's special rate, else
// today's rate; the focused line also offers the last rate quoted and sold.
// GST % comes from the item's HSN and can be changed unless the company
// setting forbids it; a local invoice can be issued without GST. On save
// the backend prices every line again, takes the number from the series
// and draws the goods out of the godown's stock, oldest first.
export function InvoiceForm({ kind, customers, catalog, godowns, luts, company, inStockOnly, fromQuotation, onSaved }: InvoiceFormProps) {
  const isExport = kind === "export";
  const eligible = customers.filter((party) => (isExport ? party.treatment === "overseas" || party.treatment === "sez" : party.treatment !== "overseas"));
  const today = useToday();
  const router = useRouter();
  const quotedParty = fromQuotation && eligible.find((candidate) => candidate.id === fromQuotation.partyId);
  const defaultGodown = godowns.find((godown) => godown.isDefault) ?? godowns[0];
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      number: "",
      date: "",
      partyId: quotedParty?.id ?? "",
      godownId: fromQuotation?.godownId ?? defaultGodown?.id ?? "",
      billToBranch: fromQuotation?.billToBranchId ?? MAIN_BRANCH,
      shipToBranch: MAIN_BRANCH,
      placeOfSupply: (quotedParty ? billedAs(quotedParty, fromQuotation?.billToBranchId).placeOfSupply : undefined) ?? "",
      shipToLine: "",
      shipToCity: "",
      exportRoute: quotedParty?.exportRoute ?? "lut",
      currency: quotedParty?.currency ?? "INR",
      gstApplicable: isExport || !chargesGst(company) ? true : (fromQuotation?.gstApplicable ?? true),
      vehicleNumber: "",
      vehicleId: "",
      notes: "",
      lines: fromQuotation?.lines.map((line) => ({
        itemId: line.itemId,
        unit: line.unit ?? "",
        quantity: String(line.quantity),
        rate: String(line.rate),
        discountPct: line.discountPct ? String(line.discountPct) : "",
        gstRatePct: fromQuotation.gstApplicable && line.gstRatePct !== undefined ? String(line.gstRatePct) : hsnRateText(catalog, line.itemId),
      })) ?? [emptyLine],
    },
  });
  const lineFields = useFieldArray({ control, name: "lines" });

  // The date is only known in the browser (see useToday); fill it once.
  useEffect(() => {
    if (today && !getValues("date")) setValue("date", today);
  }, [today, getValues, setValue]);

  const vehicles = useLiveVehicles();
  const vehicleId = useWatch({ control, name: "vehicleId" });
  /** A vehicle from the master shows its number read-only; the server records the master's number. */
  const pickVehicle = (vehicle: VehicleView | null) => {
    setValue("vehicleId", vehicle?.id ?? "");
    if (vehicle) setValue("vehicleNumber", vehicle.number, { shouldValidate: true });
  };

  const [partyId, godownId, placeOfSupply, exportRoute, currency, date, lines, gstApplicable, billToBranch, shipToBranch] = useWatch({
    control,
    name: ["partyId", "godownId", "placeOfSupply", "exportRoute", "currency", "date", "lines", "gstApplicable", "billToBranch", "shipToBranch"],
  });
  const customer = eligible.find((candidate) => candidate.id === partyId);
  // Bill to: the branch's GSTIN and state decide the tax (IGST Act s.10(1)(b)).
  const party = customer ? billedAs(customer, billToBranch) : undefined;
  const billToOptions = billingOptions(customer);
  const shipToOptions = deliveryOptions(customer);
  const branchBilled = Boolean(findBranch(customer, billToBranch));
  const lut = isExport && exportRoute === "lut" && date ? lutFor(luts, date) : undefined;
  const saleTax = invoiceTax(company, { kind, placeOfSupply, exportRoute }, party ?? { treatment: isExport ? "overseas" : "registered" });
  const tax = gstApplicable ? saleTax : withoutGst(saleTax, "sale");
  const gst: LineGstContext = { enforce: company.enforceHsnGstRate === true, applicable: gstApplicable };

  // The number a save would take; typed only when the series is not automatic.
  const { data: nextNumber } = useSWR<{ number: string | null; method: string }>(date ? numberPreviewPath(kind, date) : null, apiGet);
  const numberTyped = nextNumber !== undefined && nextNumber.method !== "AUTOMATIC";

  // Every item's rate options in one call (special, today's, last quoted, last sold, costs).
  const itemIds = useMemo(() => [...new Set((lines ?? []).map((line) => line.itemId).filter(Boolean))].sort(), [lines]);
  const optionsKey = date && itemIds.length ? ([LINE_OPTIONS_PATH, partyId || undefined, date, itemIds] as const) : null;
  const { data: optionViews } = useSWR(optionsKey, fetchLineOptions, { keepPreviousData: true });
  const optionsOf = useMemo(() => {
    const map = new Map<string, LineRateOptions>();
    for (const view of optionViews ?? []) map.set(view.itemId, toLineRateOptions(view, formatDate));
    return map;
  }, [optionViews]);

  /** Fills the suggested rate for these lines from a fresh call (a new item, or a new customer). */
  const suggest = async (indexes: number[], customerId = partyId || undefined) => {
    const wanted = indexes.map((index) => ({ index, itemId: getValues(`lines.${index}.itemId`) })).filter((row) => row.itemId);
    const day = getValues("date");
    if (!wanted.length || !day) return;
    try {
      const views = await fetchLineOptions([LINE_OPTIONS_PATH, customerId, day, [...new Set(wanted.map((row) => row.itemId))]]);
      for (const { index, itemId } of wanted) {
        const view = views.find((candidate) => candidate.itemId === itemId);
        const factor = saleLineFactor(catalog, getValues(`lines.${index}`));
        setValue(`lines.${index}.rate`, view?.rate !== null && view?.rate !== undefined ? String(ratePerUnit(view.rate, factor)) : "", { shouldValidate: true });
        setValue(`lines.${index}.discountPct`, "");
      }
    } catch {
      // The rate can always be typed.
    }
  };

  const pickParty = (id: string) => {
    const picked = eligible.find((candidate) => candidate.id === id);
    setValue("partyId", id, { shouldValidate: true });
    if (!picked) return;
    // A new customer brings their own special rates; a quotation's agreed rates stay.
    if (!fromQuotation) void suggest(getValues("lines").map((_, index) => index), id);
    setValue("billToBranch", MAIN_BRANCH);
    setValue("shipToBranch", MAIN_BRANCH);
    if (isExport) {
      setValue("exportRoute", picked.exportRoute ?? "lut");
      setValue("currency", picked.currency);
    } else {
      setValue("placeOfSupply", picked.placeOfSupply ?? company.stateCode);
    }
  };
  const addCustomer = useQuickAddParty("customer", eligible.map((candidate) => candidate.id), pickParty);
  const addGodown = useQuickAddRecord({ title: "New godown", fields: GODOWN_FIELDS, blank: GODOWN_BLANK, persistence: godownPersistence(() => {}), path: GODOWNS_PATH, listedIds: godowns.map((godown) => godown.id), onPick: (id) => setValue("godownId", id, { shouldValidate: true }) });
  const pickBillTo = (id: string) => {
    setValue("billToBranch", id);
    if (customer && !isExport) setValue("placeOfSupply", billedAs(customer, id).placeOfSupply ?? company.stateCode);
  };
  const pickShipTo = (id: string) => {
    setValue("shipToBranch", id);
    const place = findBranch(customer, id);
    setValue("shipToLine", place?.line1 ?? "");
    setValue("shipToCity", place?.city ?? "");
  };
  const pickItem = (index: number, itemId: string) => {
    setValue(`lines.${index}.itemId`, itemId, { shouldValidate: true });
    setValue(`lines.${index}.unit`, "");
    setValue(`lines.${index}.gstRatePct`, hsnRateText(catalog, itemId));
    void suggest([index]);
  };
  const pickRate = (index: number, rate: number) => {
    setValue(`lines.${index}.rate`, String(rate), { shouldValidate: true });
    setValue(`lines.${index}.discountPct`, "");
  };
  /** A new unit on the line: the typed rate follows it (₹7 a kg → ₹350 a bag). */
  const pickUnit = (index: number, unit: string, factor: number) => {
    const rate = Number(getValues(`lines.${index}.rate`));
    if (rate > 0) setValue(`lines.${index}.rate`, String(restateRate(rate, saleLineFactor(catalog, getValues(`lines.${index}`)), factor)));
    setValue(`lines.${index}.unit`, unit, { shouldValidate: true });
  };

  const rows = (lines ?? []).map((line, index) => saleLineRow(catalog, line, index, optionsOf, gst));
  const valid = rows.filter((row): row is SaleLineRow => row !== undefined && row.quantity > 0 && row.rate > 0);

  // What the schemes in force take off, asked of the backend once typing settles.
  const [schemeInput] = useDebounceValue(schemeRequest(valid), 400);
  const { data: schemes } = useSWR(date && schemeInput !== "[]" ? ([EVALUATE_SCHEMES_PATH, partyId || undefined, date, schemeInput] as const) : null, fetchSchemeResult, {
    keepPreviousData: true,
  });
  const priced = withSchemes(valid, schemes);
  const totals = previewTotals(priced, tax.regime);
  const schemeTotal = Math.round(priced.reduce((sum, row) => sum + row.schemeDiscount, 0) * 100) / 100;

  const grid = useLineGrid({
    count: lineFields.fields.length,
    append: () => lineFields.append(emptyLine, { shouldFocus: false }),
    remove: lineFields.remove,
    isFilled: (index) => Boolean(getValues(`lines.${index}.itemId`)),
    onDone: () => setStep(2),
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setResult(null);
      if (isExport && values.exportRoute === "lut" && !lut) {
        setStep(0);
        setResult({ tone: "error", text: "No LUT covers this date. Add it in GST & export setup, or export with IGST paid." });
        return;
      }
      const context = { enforce: gst.enforce, applicable: values.gstApplicable };
      const body: InvoiceBody = {
        kind: isExport ? "EXPORT" : "LOCAL",
        partyId: values.partyId,
        godownId: values.godownId,
        date: values.date,
        number: numberTyped ? values.number.trim() || null : null,
        billToBranchId: isExport ? null : branchIdOf(values.billToBranch),
        shipToBranchId: branchIdOf(values.shipToBranch),
        placeOfSupply: isExport ? null : values.placeOfSupply || null,
        exportRoute: isExport ? (values.exportRoute === "igst" ? "IGST" : "LUT") : null,
        currency: values.currency,
        shipToLine: values.shipToLine.trim() || null,
        shipToCity: values.shipToCity.trim() || null,
        vehicleNumber: values.vehicleId ? null : values.vehicleNumber.trim() || null,
        vehicleId: values.vehicleId || null,
        notes: values.notes.trim() || null,
        quotationId: fromQuotation?.id,
        challanId: fromQuotation?.challanId,
        gstApplicable: values.gstApplicable,
        lines: values.lines.map((line) => ({
          itemId: line.itemId,
          unit: line.unit || null,
          quantity: Number(line.quantity),
          rate: Number(line.rate),
          discountPct: Number(line.discountPct) || 0,
          gstRatePct: gstRateToSend(line.gstRatePct, context),
        })),
      };
      try {
        const saved = await createInvoice(body);
        await onSaved();
        router.push(`/invoices/${saved.id}`);
      } catch (error) {
        setResult({ tone: "error", text: error instanceof ApiError ? error.message : "Could not save. Check the connection and try again." });
      }
    },
    (failed) => {
      setStep(stepOfErrors(failed));
      setResult({ tone: "error", text: "Some fields need attention. The step marked red has them." });
    },
  );

  const godownName = godownId ? (godowns.find((godown) => godown.id === godownId)?.name ?? "the chosen godown") : undefined;
  const pickable = inStockOnly ? itemsInStock(catalog.items, godownId, itemIds) : catalog.items;
  const itemOptions = pickable.map((item) => ({
    value: item.id,
    label: itemLabel(item),
    detail: [item.sku, `stock ${formatQuantity(stockIn(item, godownId))}`].filter(Boolean).join(" · "),
  }));
  const customerOptions = eligible.map((candidate) => ({
    value: candidate.id,
    label: candidate.displayName,
    detail: [placeOf(candidate), candidate.gstin ?? candidate.foreignTaxId].filter(Boolean).join(" · "),
  }));
  const filledLines = (lines ?? []).filter((line) => line.itemId).length;
  const gstLocked = isExport ? "An export without GST goes under LUT: pick that route." : chargesGst(company) ? undefined : "We charge no GST (company registration).";

  return (
    <form onSubmit={onSubmit} noValidate>
      <VoucherSteps
        heading={
          <>
            <CardTitle>{KIND_TEXT[kind].title}</CardTitle>
            <StatusChip tone={isExport ? "success" : "brand"}>{isExport ? "Export" : "Local"}</StatusChip>
            {fromQuotation && <StatusChip tone="neutral">From {fromQuotation.label}</StatusChip>}
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void onSubmit()}
        steps={[
          {
            id: "buyer",
            title: isExport ? "Buyer" : "Customer",
            summary: party?.displayName,
            invalid: Boolean(errors.number || errors.date || errors.partyId || errors.godownId || errors.placeOfSupply),
            content: (
              <>
                <p className="-mt-1 text-sm font-medium text-muted">
                  {KIND_TEXT[kind].hint}
                  {!fromQuotation && (
                    <>
                      {" "}
                      <Link href={`/invoices/new/${isExport ? "local" : "export"}`} className="font-semibold text-brand hover:underline" tabIndex={-1}>
                        Switch to {isExport ? "a local" : "an export"} invoice
                      </Link>
                    </>
                  )}
                </p>
                {fromQuotation && (
                  <p className="-mt-1 text-sm font-semibold text-brand-strong">
                    {fromQuotation.challanId
                      ? `Filled from ${fromQuotation.label}: the challan is marked invoiced${fromQuotation.id ? " and its quotation converted" : ""} when this is issued. Check rates first.`
                      : `Filled from quotation ${fromQuotation.label}, which is marked converted when this is issued. Check rates and quantities first.`}
                  </p>
                )}
                <div className="grid gap-3.5 @xl:grid-cols-[minmax(0,2fr)_1fr_1fr]">
                  <ComboField
                    label={isExport ? "Buyer outside India" : "Customer"}
                    options={customerOptions}
                    value={partyId}
                    onChange={pickParty}
                    onAdd={addCustomer.open}
                    addLabel="Add a new customer"
                    disabled={Boolean(fromQuotation)}
                    error={errors.partyId?.message}
                    placeholder="Type a customer name"
                    hint={
                      party
                        ? `${party.gstin ? `GSTIN ${party.gstin}` : party.foreignTaxId ? `Tax ID ${party.foreignTaxId}` : "No GSTIN"} · ${party.creditDays === 0 ? "cash" : `${party.creditDays} days credit`}`
                        : undefined
                    }
                  />
                  {addCustomer.dialog}
                  {addGodown.dialog}
                  <TextField label="Invoice date" type="date" error={errors.date?.message} {...register("date")} />
                  <TextField
                    label="Invoice number"
                    hint={numberTyped ? "Type it, or leave blank for the next" : "Given on save"}
                    placeholder={nextNumber?.number ?? (numberTyped ? "" : "No number format yet")}
                    disabled={!numberTyped}
                    error={errors.number?.message}
                    {...register("number")}
                  />
                </div>
                <div className="grid gap-3.5 @xl:grid-cols-3">
                  <Controller
                    control={control}
                    name="godownId"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1">
                        <SelectField
                          label="Goods leave from"
                          options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))}
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                          onAdd={addGodown.open}
                          addLabel="Add a new godown"
                        />
                        {errors.godownId && <p className="text-xs font-semibold text-danger-strong">{errors.godownId.message}</p>}
                      </div>
                    )}
                  />
                  {isExport ? (
                    <>
                      <Controller
                        control={control}
                        name="exportRoute"
                        render={({ field }) => (
                          <SelectField
                            label="Export route"
                            options={[
                              { value: "lut", label: "Under LUT, no GST" },
                              { value: "igst", label: "IGST paid, refund later" },
                            ]}
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="currency"
                        render={({ field }) => (
                          <SelectField
                            label="Currency"
                            options={[
                              { value: "INR", label: "INR" },
                              { value: "BTN", label: "BTN" },
                            ]}
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        )}
                      />
                    </>
                  ) : (
                    <Controller
                      control={control}
                      name="placeOfSupply"
                      render={({ field }) => (
                        <SelectField
                          label={branchBilled ? "Place of supply · the bill-to state" : "Place of supply"}
                          options={INDIAN_STATES.map((state) => ({ value: state.code, label: `${state.name} (${state.code})` }))}
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                          disabled={branchBilled}
                        />
                      )}
                    />
                  )}
                  {!isExport && billToOptions.length > 1 && (
                    <SelectField label="Bill to (branch)" options={billToOptions} value={billToBranch} onValueChange={pickBillTo} />
                  )}
                </div>
                <GstApplicableToggle value={gstApplicable} onChange={(value) => setValue("gstApplicable", value)} lockedReason={gstLocked} />
                {isExport ? (
                  <div className={lut || exportRoute === "igst" ? "glass-inset rounded-(--radius-tile) px-4 py-3" : "rounded-(--radius-tile) bg-danger-tint px-4 py-3"}>
                    <p className="text-xs font-medium text-muted">Printed on the invoice</p>
                    <p className="text-sm font-semibold">{exportDeclaration({ exportRoute, lutArn: lut?.arn })}</p>
                    {exportRoute === "lut" && !lut && date && (
                      <p className="text-xs font-semibold text-danger-strong">No LUT covers {formatDate(date)}. Add it in GST & export setup.</p>
                    )}
                  </div>
                ) : (
                  <div className={tax.blocked ? "rounded-(--radius-tile) bg-danger-tint px-4 py-3" : "glass-inset rounded-(--radius-tile) px-4 py-3"}>
                    <p className="text-sm font-semibold">{tax.title}</p>
                    <p className="text-xs font-semibold text-ink-soft">
                      {tax.blocked ??
                        (gstApplicable && placeOfSupply && chargesGst(company)
                          ? `Place of supply ${stateName(placeOfSupply)}: ${placeOfSupply === company.stateCode ? "same state, CGST + SGST" : "other state, IGST"}.`
                          : tax.detail)}
                    </p>
                  </div>
                )}
              </>
            ),
          },
          {
            id: "items",
            title: "Items",
            summary: filledLines ? `${filledLines} line${filledLines === 1 ? "" : "s"}` : undefined,
            invalid: Boolean(errors.lines),
            onEnterAtEnd: grid.enterAtEnd,
            content: (
              <>
                {inStockOnly && (
                  <p className="text-xs font-semibold text-muted">
                    Listing only items in stock {godownName ? `in ${godownName}` : "in any godown"} (Settings → Sales).
                    {pickable.length === 0 && " None has stock there."}
                  </p>
                )}
                {errors.lines?.root?.message && <p className="text-xs font-semibold text-danger-strong">{errors.lines.root.message}</p>}
                <SaleLineGrid
                  grid={grid}
                  rowKeys={lineFields.fields.map((field) => field.id)}
                  lines={lines ?? []}
                  rows={rows}
                  priced={priced}
                  itemOptions={itemOptions}
                  gst={gst}
                  regime={tax.regime}
                  registerLine={(index, field) => register(`lines.${index}.${field}`)}
                  errorOf={(index, field) => errors.lines?.[index]?.[field]?.message}
                  onPickItem={pickItem}
                  onPickUnit={pickUnit}
                  onPickRate={pickRate}
                  stockOf={(row, line) => ({
                    // The godown's own stock: issuing draws only from it.
                    text: `Stock ${formatQuantity(stockIn(row.item, godownId))} ${row.baseUnit} ${godownName ? `in ${godownName}` : "in all godowns"}`,
                    short: row.base.quantity + (line?.freeQuantity ?? 0) > stockIn(row.item, godownId),
                  })}
                />
              </>
            ),
          },
          {
            id: "delivery",
            title: "Delivery",
            summary: vehicleId ? vehicles.find((vehicle) => vehicle.id === vehicleId)?.number : undefined,
            invalid: Boolean(errors.vehicleNumber || errors.shipToLine || errors.shipToCity || errors.notes),
            content: (
              <>
                <div className="grid gap-3.5 @xl:grid-cols-2">
                  <VehicleSelect vehicles={vehicles} vehicleId={vehicleId} onPick={pickVehicle} />
                  <TextField
                    label="Vehicle number"
                    placeholder="WB73E1234"
                    readOnly={Boolean(vehicleId)}
                    hint={vehicleId ? PICKED_VEHICLE_HINT : undefined}
                    error={errors.vehicleNumber?.message}
                    {...register("vehicleNumber")}
                  />
                </div>
                {shipToOptions.length > 1 && (
                  <SelectField label="Ship to" options={shipToOptions} value={shipToBranch} onValueChange={pickShipTo} />
                )}
                <div className="grid gap-3.5 @xl:grid-cols-[2fr_1fr]">
                  <TextField
                    label={isExport ? "Deliver to (consignee address)" : "Ship to, if not the billing address"}
                    placeholder={party ? party.billing.line1 : "Street, site or godown"}
                    error={errors.shipToLine?.message}
                    {...register("shipToLine")}
                  />
                  <TextField label="Town / city" placeholder={party?.billing.city} error={errors.shipToCity?.message} {...register("shipToCity")} />
                </div>
                <TextField label="Notes on the invoice" placeholder="Delivery terms, site name" error={errors.notes?.message} {...register("notes")} />
                {result && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
                <p className="text-xs font-semibold text-muted">
                  Issuing numbers the invoice and takes the goods out of {godownName ?? "stock"}, oldest first. It is not edited afterwards: cancel it (the stock goes back) and issue a new one.
                </p>
              </>
            ),
          },
        ]}
        actions={
          <>
            <Link href="/invoices" className={buttonClasses("neutral")} tabIndex={-1}>
              Back to invoices
            </Link>
            <Button type="submit" disabled={isSubmitting} data-voucher-accept="">
              {isSubmitting ? "Issuing…" : "Issue invoice"}
            </Button>
          </>
        }
        aside={
          <>
            <InvoiceTotalsCard totals={totals} tax={tax} currency={currency} schemeDiscount={schemeTotal} />
            {result && step !== 2 && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
          </>
        }
      />
    </form>
  );
}
