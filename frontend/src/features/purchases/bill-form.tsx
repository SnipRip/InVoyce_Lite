"use client";

import { billedAs, billingOptions, branchIdOf, MAIN_BRANCH } from "@/features/parties/party-branches";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { LineGrid, useLineGrid } from "@/components/ui/line-grid";
import { LoadNotice } from "@/components/ui/load-notice";
import { SelectField } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { GstApplicableToggle } from "@/features/gst/gst-applicable-toggle";
import { describeComponents, treatmentLabel } from "@/features/gst/gst-rules";
import { stateName } from "@/features/gst/indian-states";
import { LineGstCell } from "@/features/gst/line-gst-cell";
import { gstRateToSend, withoutGst, type LineGstContext } from "@/features/gst/line-gst-rate";
import { lineTotals } from "@/features/invoices/invoice-rules";
import { hsnRateText, itemLabel, resolveItemDefaults, type ItemCatalog } from "@/features/items/item-rules";
import { LineUnitSelect } from "@/features/items/line-unit-select";
import { conversionText, restateRate, typedLine, type UnitChoice } from "@/features/items/line-units";
import { expenseHeadsOf, findHead } from "@/features/masters/account-head-rules";
import { allocationLabel } from "@/features/masters/expense-heads-master";
import { useAccountHeads } from "@/features/masters/use-account-heads";
import { placeOf } from "@/features/parties/party-rules";
import type { Party } from "@/features/parties/types";
import type { Godown } from "@/features/masters/types";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import type { PurchaseOrderView } from "@/types/purchase";
import { useToday } from "@/lib/use-today";
import { billSchema, type BillFormValues } from "./bill-schema";
import { BillTotalsCard } from "./bill-totals-card";
import {
  billChargeRate,
  billDueDate,
  billTax,
  billTotals,
  CHARGE_RATES,
  chargeRateRule,
  isMsme,
  LANDED_COST_METHODS,
  landsOnItems,
  MSME_PAYMENT_DAYS,
  splitRegime,
} from "./purchase-rules";
import { createBill, fetchLastRates } from "./purchases-api";
import type { BillCharge, BillKind, BillLine, ChargeHead } from "./types";
import type { OurRegistration } from "@/types/company";
import { useQuickAddParty } from "@/features/parties/quick-add-party";
import { useQuickAddItem } from "@/features/items/quick-add-item";

interface BillFormProps {
  vendors: Party[];
  catalog: ItemCatalog;
  /** Goods bills a charges bill can be tagged to. */
  purchases: { id: string; label: string }[];
  godowns: Godown[];
  company: OurRegistration;
  initialKind: BillKind;
  initialFor?: string;
  /** Receiving against this order: its vendor, godown and pending lines come in. */
  order?: PurchaseOrderView;
  /** After the save: reload what the other screens read. */
  onSaved: () => Promise<void>;
}

const NOT_TAGGED = "none";

const KIND_TEXT: Record<BillKind, { label: string; hint: string }> = {
  goods: { label: "Goods for stock", hint: "Items come into stock at the bill's rate plus any freight and labour tagged to it." },
  charges: {
    label: "Freight, loading or labour",
    hint: "A transporter's or loader's bill. Tag it to the purchase it belongs to and its cost lands on those items.",
  },
};

const emptyLine = { itemId: "", orderLineId: "", unit: "", quantity: "", rate: "", discountPct: "", gstRatePct: "", itc: "eligible" as const };
const qty3 = (value: number) => Math.round(value * 1000) / 1000;
const emptyCharge = { head: "", description: "", amount: "", gstRatePct: "18" };

const LINE_COLUMNS = "minmax(0,3fr) 88px minmax(72px,0.8fr) minmax(84px,0.9fr) 64px 64px minmax(96px,1fr)";
const LINE_HEADERS = [
  { label: "Item" },
  { label: "Unit" },
  { label: "Quantity", align: "right" as const },
  { label: "Rate ₹", align: "right" as const },
  { label: "Disc %", align: "right" as const },
  { label: "GST %", align: "right" as const },
  { label: "Before GST ₹", align: "right" as const },
];
const CHARGE_COLUMNS = "minmax(0,1.4fr) minmax(0,2fr) minmax(96px,1fr) minmax(110px,1fr)";
const CHARGE_HEADERS = [{ label: "Charge" }, { label: "Details" }, { label: "Amount ₹", align: "right" as const }, { label: "GST" }];

/** The step each field is on, to open the first step with an error. */
const stepOfErrors = (errors: FieldErrors<BillFormValues>, goods: boolean) => {
  if (errors.vendorId || errors.vendorBillNumber || errors.date || errors.dueDate || errors.godownId) return 0;
  if (goods ? errors.lines : errors.charges) return 1;
  return 2;
};

// A vendor bill, entered from the vendor's paper in three steps that each fit
// the screen: vendor and bill, items (or the charges of a freight bill),
// then freight, e-way bill and notes. GST follows the vendor's treatment and
// the source of supply (gst-rules.ts); each line's GST % comes from its HSN
// and can be typed as printed unless the company setting forbids it, and the
// whole bill can be marked "GST not applicable". Freight and loading on a
// goods bill follow the bill's rate; a separate charges bill is tagged to the
// purchase for landed cost.
export function BillForm({ vendors, catalog, purchases, godowns, company, initialKind, initialFor, order, onSaved }: BillFormProps) {
  const today = useToday();
  const router = useRouter();
  const orderVendor = order && vendors.find((candidate) => candidate.id === order.vendorId);
  const defaultGodown = godowns.find((godown) => godown.isDefault && !godown.archived) ?? godowns.find((godown) => !godown.archived);
  const pendingLines = order?.lines.filter((line) => line.pending > 0) ?? [];
  const { heads, error: headsError } = useAccountHeads();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      kind: initialKind,
      vendorId: order?.vendorId ?? "",
      vendorBillNumber: "",
      date: "",
      dueDate: "",
      vendorBranch: MAIN_BRANCH,
      gstApplicable: true,
      landedCostFor: initialFor ?? "",
      godownId: order?.godownId ?? defaultGodown?.id ?? "",
      purchaseOrderId: order?.id ?? "",
      allocation: "value",
      ewayNumber: "",
      ewayDate: "",
      vehicleNumber: "",
      notes: "",
      lines: pendingLines.length
        ? pendingLines.map((line) => ({
            itemId: line.itemId,
            orderLineId: line.id,
            // In the unit it was ordered in; pending is counted in base units.
            unit: line.entered.unit,
            quantity: String(qty3(line.pending / line.entered.factor)),
            rate: String(line.entered.rate),
            discountPct: line.discountPct ? String(line.discountPct) : "",
            gstRatePct: String(line.gstRatePct),
            itc: "eligible" as const,
          }))
        : [emptyLine],
      charges: initialKind === "charges" ? [emptyCharge] : [],
    },
  });
  const lineFields = useFieldArray({ control, name: "lines" });
  const chargeFields = useFieldArray({ control, name: "charges" });

  // The date is only known in the browser (see useToday); fill it once.
  useEffect(() => {
    if (!today || getValues("date")) return;
    setValue("date", today);
    if (orderVendor) setValue("dueDate", billDueDate(today, orderVendor));
  }, [today, getValues, setValue, orderVendor]);

  const [kind, vendorId, vendorBranch, lines, charges, landedCostFor, gstApplicable, billDate, dueDate] = useWatch({
    control,
    name: ["kind", "vendorId", "vendorBranch", "lines", "charges", "landedCostFor", "gstApplicable", "date", "dueDate"],
  });
  const isGoods = kind === "goods";
  const eligibleVendors = isGoods ? vendors.filter((vendor) => !vendor.isGta) : vendors;
  const vendor = vendors.find((candidate) => candidate.id === vendorId);
  // The branch that billed us decides the GST: its treatment and state (the source of supply).
  const billedVendor = vendor ? billedAs(vendor, vendorBranch) : undefined;
  const sourceOfSupply = billedVendor?.placeOfSupply;
  const branchOptions = billingOptions(vendor);
  const vendorTax = billedVendor ? billTax(company, billedVendor, sourceOfSupply) : undefined;
  const tax = vendorTax && !gstApplicable ? withoutGst(vendorTax, "bill") : vendorTax;
  const split = tax ? splitRegime(tax, company, sourceOfSupply) : "no-gst";
  const gst: LineGstContext = { enforce: company.enforceHsnGstRate === true, applicable: gstApplicable };
  // Charges are booked under the live expense heads; each head brings its GST behaviour and where its cost lands.
  const chargeHeads: ChargeHead[] = expenseHeadsOf(heads ?? []);
  const headOf = (ref?: string) => (ref ? findHead(chargeHeads, ref) : undefined);
  const rateRuleFor = (ref?: string) => (tax ? chargeRateRule(tax, headOf(ref)) : undefined);
  // A charges bill adds to a purchase's items only through heads that land on
  // item cost; until a head is picked the tag (say from ?for=) stays.
  const pickedHeads = (charges ?? []).map((charge) => headOf(charge.head)).filter((head) => head !== undefined);
  const landsOnPurchase = pickedHeads.length === 0 || pickedHeads.some(landsOnItems);
  const vendorRule = tax ? chargeRateRule(tax) : undefined;

  // A charge's tag to a purchase goes when no charge lands on item cost any more.
  useEffect(() => {
    if (!landsOnPurchase && getValues("landedCostFor")) setValue("landedCostFor", "");
  }, [landsOnPurchase, getValues, setValue]);

  const setDueDate = (date: string, picked = vendor) => {
    if (picked && /^\d{4}-\d{2}-\d{2}$/.test(date)) setValue("dueDate", billDueDate(date, picked));
  };

  const pickVendor = (id: string) => {
    const picked = vendors.find((candidate) => candidate.id === id);
    setValue("vendorId", id, { shouldValidate: true });
    if (!picked) return;
    setValue("vendorBranch", MAIN_BRANCH);
    setDueDate(getValues("date"), picked);
  };
  const addVendor = useQuickAddParty("vendor", eligibleVendors.map((candidate) => candidate.id), pickVendor);

  const pickKind = (next: BillKind) => {
    setValue("kind", next);
    if (vendor && next === "goods" && vendor.isGta) setValue("vendorId", "");
    if (next === "charges" && getValues("charges").length === 0) chargeFields.append(emptyCharge);
  };

  // A head with its own rate (or none) sets the charge's rate; one that follows the bill keeps what was picked.
  const pickHead = (index: number, id: string) => {
    setValue(`charges.${index}.head`, id, { shouldValidate: true });
    const rule = rateRuleFor(id);
    if (rule?.fixed !== undefined) setValue(`charges.${index}.gstRatePct`, String(rule.fixed));
  };

  // The item has no purchase price of its own; the last bill from this
  // vendor (else any vendor) suggests one. Only a start: type what the bill says.
  const [lastPaid, setLastPaid] = useState<Record<number, string>>({});
  const pickItem = async (index: number, itemId: string) => {
    setValue(`lines.${index}.itemId`, itemId, { shouldValidate: true });
    setValue(`lines.${index}.orderLineId`, "");
    setValue(`lines.${index}.unit`, "");
    setValue(`lines.${index}.gstRatePct`, hsnRateText(catalog, itemId));
    try {
      const [last] = await fetchLastRates(["last-rates", vendorId || undefined, itemId] as const);
      if (last && !getValues(`lines.${index}.rate`)) setValue(`lines.${index}.rate`, String(last.rate));
      const item = catalog.items.find((candidate) => candidate.id === itemId);
      const baseUnit = item ? (resolveItemDefaults(catalog, item).unit.value ?? "") : "";
      setLastPaid((current) => ({
        ...current,
        [index]: last
          ? `Last paid ${formatRate(last.rate)} per ${baseUnit} on ${formatDate(last.date)}${last.fromThisVendor ? "" : ` to ${last.vendorName}`}`
          : "Not bought before",
      }));
    } catch {
      // Only a suggestion: the rate is typed from the bill anyway.
    }
  };

  /** A new unit on the line, as printed on the vendor's bill: the typed rate follows it. */
  const pickUnit = (index: number, unit: string, factor: number) => {
    const rate = Number(getValues(`lines.${index}.rate`));
    const from = toBillLine(getValues(`lines.${index}`))?.unitFactor ?? 1;
    if (rate > 0) setValue(`lines.${index}.rate`, String(restateRate(rate, from, factor)));
    setValue(`lines.${index}.unit`, unit, { shouldValidate: true });
  };

  const toBillLine = (line?: BillFormValues["lines"][number]): (BillLine & { choices: UnitChoice[]; hsnRatePct?: number }) | undefined => {
    const typed = typedLine(catalog, line, gst.enforce);
    return typed && line && { ...typed, itc: line.itc };
  };
  const billLines: BillLine[] = isGoods ? (lines ?? []).map(toBillLine).filter((line) => line !== undefined) : [];
  const billCharges: BillCharge[] = (charges ?? []).map((charge) => ({
    head: charge.head,
    amount: Number(charge.amount) || 0,
    gstRatePct: isGoods ? undefined : (rateRuleFor(charge.head)?.fixed ?? Number(charge.gstRatePct)),
  }));
  const totals = tax ? billTotals({ kind, lines: billLines, charges: billCharges }, tax, split) : undefined;
  const goodsRate = billChargeRate(billLines);

  const lineGrid = useLineGrid({
    count: lineFields.fields.length,
    append: () => lineFields.append(emptyLine, { shouldFocus: false }),
    remove: lineFields.remove,
    isFilled: (index) => Boolean(getValues(`lines.${index}.itemId`)),
    onDone: () => setStep(2),
  });
  const chargeGrid = useLineGrid({
    count: chargeFields.fields.length,
    append: () => chargeFields.append(emptyCharge, { shouldFocus: false }),
    remove: chargeFields.remove,
    isFilled: (index) => Boolean(getValues(`charges.${index}.head`)),
    // Goods bills: freight is optional, and the e-way bill comes next. Freight bills: on to notes.
    onDone: () => (isGoods ? setTimeout(() => document.querySelector<HTMLElement>("[data-after-charges]")?.focus()) : setStep(2)),
    minimum: isGoods ? 0 : 1,
  });

  const onSubmit = handleSubmit(
    async (values) => {
      setResult(null);
      const goods = values.kind === "goods";
      const context = { enforce: gst.enforce, applicable: values.gstApplicable };
      try {
        const saved = await createBill({
          kind: goods ? "GOODS" : "CHARGES",
          vendorId: values.vendorId,
          vendorBillNumber: values.vendorBillNumber,
          date: values.date,
          dueDate: values.dueDate || undefined,
          vendorBranchId: branchIdOf(values.vendorBranch),
          gstApplicable: values.gstApplicable,
          godownId: goods ? values.godownId : null,
          purchaseOrderId: goods && values.purchaseOrderId ? values.purchaseOrderId : null,
          allocation: values.allocation.toUpperCase(),
          landedCostForId: !goods && values.landedCostFor ? values.landedCostFor : null,
          ewayBillNumber: goods ? values.ewayNumber || null : null,
          ewayBillDate: goods && values.ewayNumber ? values.ewayDate : null,
          vehicleNumber: goods ? values.vehicleNumber || null : null,
          notes: values.notes || null,
          lines: goods
            ? values.lines.map((line) => ({
                itemId: line.itemId,
                orderLineId: line.orderLineId || null,
                unit: line.unit || null,
                quantity: Number(line.quantity),
                rate: Number(line.rate),
                discountPct: Number(line.discountPct) || 0,
                gstRatePct: gstRateToSend(line.gstRatePct, context),
                itcEligible: line.itc === "eligible",
              }))
            : [],
          charges: values.charges.map((charge) => ({
            headId: charge.head,
            description: charge.description || null,
            amount: Number(charge.amount),
            gstRatePct: goods ? undefined : (rateRuleFor(charge.head)?.fixed ?? Number(charge.gstRatePct)),
          })),
        });
        await onSaved();
        router.push(`/purchases/${saved.id}`);
      } catch (error) {
        setResult({ tone: "error", text: error instanceof ApiError ? error.message : "Could not save. Check the connection and try again." });
      }
    },
    (failed) => {
      setStep(stepOfErrors(failed, getValues("kind") === "goods"));
      setResult({ tone: "error", text: "Some fields need attention. The step marked red has them." });
    },
  );

  const addItem = useQuickAddItem<number>(catalog.items.map((item) => item.id), (itemId, index) => void pickItem(index, itemId));

  if (!heads) return <LoadNotice error={headsError} what="expense heads" />;

  const itemOptions = catalog.items.map((item) => ({ value: item.id, label: itemLabel(item), detail: item.sku ?? undefined }));
  const vendorOptions = eligibleVendors.map((candidate) => ({
    value: candidate.id,
    label: candidate.displayName,
    detail: [placeOf(candidate), candidate.gstin].filter(Boolean).join(" · "),
  }));
  const headOptions = chargeHeads.map((option) => ({ value: option.id, label: option.name }));
  const errorText = (message?: string) => message && <p className="text-xs font-semibold text-danger-strong">{message}</p>;

  const activeLine = toBillLine(lines?.[lineGrid.active]);
  const activeLineTotal = activeLine ? lineTotals(activeLine, split) : undefined;
  const activeOrderLine = lines?.[lineGrid.active]?.orderLineId;
  const filledLines = billLines.length;

  const chargeGridView = (
    <LineGrid
      grid={chargeGrid}
      rowKeys={chargeFields.fields.map((field) => field.id)}
      label={isGoods ? "Freight and loading" : "Charges"}
      columns={CHARGE_COLUMNS}
      headers={CHARGE_HEADERS}
      addLabel="Add a charge"
      renderRow={(index) => {
        const rule = rateRuleFor(charges?.[index]?.head);
        const head = headOf(charges?.[index]?.head);
        return (
          <>
            <ComboField
              label="Charge"
              hideLabel
              options={headOptions}
              value={headOf(charges?.[index]?.head)?.id ?? ""}
              onChange={(id) => pickHead(index, id)}
              onEmptyEnter={() => chargeGrid.emptyEnter(index)}
              error={errors.charges?.[index]?.head?.message}
              placeholder="Type a head"
              hint={head?.allocation ? allocationLabel(head.allocation) : undefined}
              inputProps={{ "data-line-start": true }}
            />
            <TextField label="Details" hideLabel placeholder="Route, truck, men" {...register(`charges.${index}.description`)} />
            <TextField label="Amount" hideLabel inputMode="decimal" className="text-right" error={errors.charges?.[index]?.amount?.message} {...register(`charges.${index}.amount`)} />
            {isGoods ? (
              <span className="flex h-[34px] items-center text-[13px] font-semibold">{tax?.regime === "no-gst" || tax?.itc === false ? "None" : `${goodsRate}%, as the bill`}</span>
            ) : rule?.fixed !== undefined ? (
              <span className="flex h-[34px] items-center text-[13px] font-semibold">
                {rule.fixed}%{vendorRule?.fixed === undefined && head ? ", from the head" : ""}
              </span>
            ) : (
              <Controller
                control={control}
                name={`charges.${index}.gstRatePct`}
                render={({ field: rateField }) => (
                  <SelectField
                    label="GST on the bill"
                    hideLabel
                    options={(rule?.options ?? CHARGE_RATES).map((rate) => ({ value: String(rate), label: `${rate}%` }))}
                    value={rateField.value}
                    onValueChange={rateField.onChange}
                    disabled={!vendor}
                  />
                )}
              />
            )}
          </>
        );
      }}
    />
  );

  const chargesNote = isGoods
    ? `Only what the vendor printed on this bill. They take the bill's GST rate${billLines.length ? ` (${goodsRate}%)` : ""}. A transporter's own bill is a separate freight bill.`
    : vendorRule?.fixed !== undefined
      ? tax?.regime === "reverse-charge"
        ? `Reverse charge: the transporter charges no GST; we pay ${vendorRule.fixed}% and claim it back.`
        : "No GST bill: the amount is the cost."
      : "Each head brings its GST: none, its own rate, or the rate printed on the vendor's bill.";

  const notesAndAttach = (
    <>
      <TextField label="Notes" placeholder="Anything about this bill" error={errors.notes?.message} {...register("notes")} />
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="neutral" disabled tabIndex={-1}>
          <Paperclip aria-hidden="true" className="size-[18px]" />
          Attach the vendor&rsquo;s bill
        </Button>
        <span className="text-xs font-semibold text-muted">Uploading scans switches on when file storage is chosen.</span>
      </div>
      {result && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
    </>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <VoucherSteps
        heading={
          <>
            <CardTitle>New bill</CardTitle>
            <StatusChip tone="neutral">Numbered on save</StatusChip>
            {order && <StatusChip tone="brand">Against {order.number}</StatusChip>}
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void onSubmit()}
        steps={[
          {
            id: "vendor",
            title: "Vendor & bill",
            summary: vendor?.displayName,
            invalid: Boolean(errors.vendorId || errors.vendorBillNumber || errors.date || errors.dueDate || errors.godownId),
            content: (
              <>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">What is this bill for?</span>
                    <FilterGroup label="What is this bill for?">
                      {(["goods", "charges"] as const).map((option) => (
                        <FilterChip key={option} selected={kind === option} disabled={Boolean(order) && option === "charges"} onClick={() => pickKind(option)}>
                          {KIND_TEXT[option].label}
                        </FilterChip>
                      ))}
                    </FilterGroup>
                  </div>
                  <GstApplicableToggle value={gstApplicable} onChange={(value) => setValue("gstApplicable", value)} />
                </div>
                <p className="-mt-1.5 text-sm font-medium text-muted">{KIND_TEXT[kind].hint}</p>
                <div className="grid gap-3.5 @xl:grid-cols-[minmax(0,2fr)_1fr]">
                  <ComboField
                    label="Vendor"
                    options={vendorOptions}
                    value={vendorId}
                    onChange={pickVendor}
                    onAdd={addVendor.open}
                    addLabel="Add a new vendor"
                    disabled={Boolean(order)}
                    error={errors.vendorId?.message}
                    placeholder="Type a vendor name"
                    hint={
                      vendor && billedVendor
                        ? `${billedVendor.gstin ? `GSTIN ${billedVendor.gstin}` : "No GSTIN"} · ${treatmentLabel(billedVendor.treatment)}${vendor.isGta ? " · goods transport agency" : ""}${isMsme(vendor) ? ` · MSME, pay within ${MSME_PAYMENT_DAYS} days` : ""}`
                        : undefined
                    }
                  />
                  {addVendor.dialog}
                  {addItem.dialog}
                  {branchOptions.length > 1 ? (
                    <Controller
                      control={control}
                      name="vendorBranch"
                      render={({ field }) => (
                        <SelectField label="Billed from (branch)" options={branchOptions} value={field.value} onValueChange={field.onChange} />
                      )}
                    />
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted">Billed from</span>
                      <p className="glass-inset flex h-9 items-center rounded-(--radius-control) px-3 text-sm font-medium text-ink-soft">
                        {vendor ? (vendor.treatment === "overseas" ? "Outside India" : (stateName(sourceOfSupply) ?? "—")) : "Pick the vendor"}
                      </p>
                    </div>
                  )}
                </div>
                <div className={isGoods ? "grid gap-3.5 @xl:grid-cols-3" : "grid gap-3.5 @xl:grid-cols-2"}>
                  <TextField label="Vendor's bill number" placeholder="As printed on the bill" error={errors.vendorBillNumber?.message} {...register("vendorBillNumber")} />
                  <TextField
                    label="Bill date"
                    type="date"
                    hint={
                      vendor && dueDate && billDate
                        ? `Due ${formatDate(dueDate)} · ${vendor.creditDays ? `${vendor.creditDays} days credit` : "cash"}${isMsme(vendor) && vendor.creditDays > MSME_PAYMENT_DAYS ? ", capped at 45 for MSME" : ""} from the vendor master`
                        : undefined
                    }
                    error={errors.date?.message ?? errors.dueDate?.message}
                    {...register("date", { onChange: (event) => setDueDate(event.target.value) })}
                  />
                  {isGoods && (
                    <Controller
                      control={control}
                      name="godownId"
                      render={({ field }) => (
                        <div className="flex flex-col gap-1">
                          <SelectField
                            label="Received into"
                            options={godowns.filter((godown) => !godown.archived).map((godown) => ({ value: godown.id, label: godown.name }))}
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          />
                          {errorText(errors.godownId?.message)}
                        </div>
                      )}
                    />
                  )}
                </div>
                {tax && (
                  <div className={tax.itc ? "glass-inset rounded-(--radius-tile) px-4 py-3" : "rounded-(--radius-tile) bg-warning-tint px-4 py-3"}>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {tax.title}
                      <StatusChip tone={tax.itc ? "success" : "warning"}>{tax.itc ? "Input credit claimable" : "No input credit"}</StatusChip>
                    </p>
                    <p className="text-xs font-semibold text-ink-soft">{tax.detail}</p>
                  </div>
                )}
                {order && (
                  <p className="text-xs font-semibold text-muted">
                    The items are what {order.number} still has to come. Change the quantities to what arrived; remove what did not.
                  </p>
                )}
              </>
            ),
          },
          isGoods
            ? {
                id: "items",
                title: "Items",
                summary: filledLines ? `${filledLines} line${filledLines === 1 ? "" : "s"}` : undefined,
                invalid: Boolean(errors.lines),
                onEnterAtEnd: lineGrid.enterAtEnd,
                content: (
                  <>
                    {errorText(errors.lines?.root?.message ?? errors.lines?.message)}
                    <LineGrid
                      grid={lineGrid}
                      rowKeys={lineFields.fields.map((field) => field.id)}
                      label="Items"
                      columns={LINE_COLUMNS}
                      headers={LINE_HEADERS}
                      addLabel="Add an item"
                      renderRow={(index) => {
                        const line = toBillLine(lines?.[index]);
                        const lineErrors = errors.lines?.[index];
                        return (
                          <>
                            <ComboField
                              label="Item"
                              hideLabel
                              options={itemOptions}
                              value={lines?.[index]?.itemId ?? ""}
                              onChange={(itemId) => void pickItem(index, itemId)}
                              onEmptyEnter={() => lineGrid.emptyEnter(index)}
                              onAdd={() => addItem.open(index)}
                              addLabel="Add a new item"
                              disabled={Boolean(lines?.[index]?.orderLineId)}
                              error={lineErrors?.itemId?.message}
                              placeholder="Type an item name or SKU"
                              inputProps={{ "data-line-start": true }}
                            />
                            <LineUnitSelect hideLabel choices={line?.choices ?? []} value={lines?.[index]?.unit ?? ""} onChange={(unit, factor) => pickUnit(index, unit, factor)} />
                            <TextField label="Quantity" hideLabel inputMode="decimal" className="text-right" error={lineErrors?.quantity?.message} {...register(`lines.${index}.quantity`)} />
                            <TextField label="Rate" hideLabel inputMode="decimal" className="text-right" error={lineErrors?.rate?.message} {...register(`lines.${index}.rate`)} />
                            <TextField label="Discount %" hideLabel inputMode="decimal" className="text-right" error={lineErrors?.discountPct?.message} {...register(`lines.${index}.discountPct`)} />
                            <LineGstCell master={line?.hsnRatePct} context={gst} error={lineErrors?.gstRatePct?.message} {...register(`lines.${index}.gstRatePct`)} />
                            <span className="flex h-[34px] items-center justify-end text-[13px] font-semibold tabular-nums">{line ? formatRate(lineTotals(line, split).taxable) : ""}</span>
                          </>
                        );
                      }}
                      detail={
                        activeLine && activeLineTotal ? (
                          <div className="glass-inset flex flex-col gap-2 rounded-(--radius-tile) p-3">
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
                              <span className="text-ink">
                                Line {lineGrid.active + 1}: {activeLine.description}
                              </span>
                              {activeOrderLine ? (
                                <span>
                                  From {order?.number}: {formatQuantity(order?.lines.find((row) => row.id === activeOrderLine)?.pending ?? 0)} {activeLine.baseUnit} pending
                                </span>
                              ) : (
                                lastPaid[lineGrid.active] && <span>{lastPaid[lineGrid.active]}</span>
                              )}
                              {activeLine.unitFactor !== 1 && (
                                <span>
                                  {conversionText(activeLine.unit, activeLine.unitFactor ?? 1, activeLine.baseUnit ?? "")} ·{" "}
                                  {formatQuantity(Math.round(activeLine.quantity * (activeLine.unitFactor ?? 1) * 1000) / 1000)} {activeLine.baseUnit} into stock
                                </span>
                              )}
                              <span>HSN {activeLine.hsn || "not set"}</span>
                              <span>
                                GST {activeLine.gstRatePct}% → {describeComponents(activeLine.gstRatePct, tax?.regime ?? "no-gst")}
                                {gst.applicable && !gst.enforce && activeLine.hsnRatePct !== undefined && activeLine.gstRatePct !== activeLine.hsnRatePct && ` (HSN rate ${activeLine.hsnRatePct}%)`}
                              </span>
                            </p>
                            {tax?.itc && (
                              <Controller
                                control={control}
                                name={`lines.${lineGrid.active}.itc`}
                                render={({ field: itcField }) => (
                                  <FilterGroup label="Input credit">
                                    <FilterChip selected={itcField.value === "eligible"} onClick={() => itcField.onChange("eligible")}>
                                      Claim input credit
                                    </FilterChip>
                                    <FilterChip selected={itcField.value === "ineligible"} onClick={() => itcField.onChange("ineligible")}>
                                      Not eligible, 17(5)
                                    </FilterChip>
                                  </FilterGroup>
                                )}
                              />
                            )}
                          </div>
                        ) : (
                          <p className="glass-inset rounded-(--radius-tile) p-3 text-xs font-semibold text-muted">
                            Pick an item: its HSN, GST, last rate paid and input credit show here. Enter on a blank line moves on.
                          </p>
                        )
                      }
                    />
                  </>
                ),
              }
            : {
                id: "charges",
                title: "Charges",
                summary: pickedHeads.length ? `${pickedHeads.length} charge${pickedHeads.length === 1 ? "" : "s"}` : undefined,
                invalid: Boolean(errors.charges),
                onEnterAtEnd: chargeGrid.enterAtEnd,
                content: (
                  <>
                    <p className="-mt-1 text-sm font-medium text-muted">{chargesNote}</p>
                    {errorText(errors.charges?.root?.message ?? errors.charges?.message)}
                    {chargeGridView}
                  </>
                ),
              },
          isGoods
            ? {
                id: "freight",
                title: "Freight & e-way",
                invalid: Boolean(errors.charges || errors.ewayNumber || errors.ewayDate || errors.vehicleNumber || errors.notes),
                content: (
                  <>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold">Freight and loading on this bill</h3>
                      <p className="-mt-1 text-xs font-semibold text-muted">{chargesNote}</p>
                      {chargeGridView}
                      <Controller
                        control={control}
                        name="allocation"
                        render={({ field }) => (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <FilterGroup label="Spread freight and tagged bills over the items by">
                              {LANDED_COST_METHODS.map((option) => (
                                <FilterChip key={option.value} selected={field.value === option.value} onClick={() => field.onChange(option.value)}>
                                  {option.label}
                                </FilterChip>
                              ))}
                            </FilterGroup>
                            <p className="text-xs font-semibold text-muted">{LANDED_COST_METHODS.find((option) => option.value === field.value)?.hint}. It can be changed on the bill later.</p>
                          </div>
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold">E-way bill</h3>
                      <p className="-mt-1 text-xs font-semibold text-muted">The vendor generates it; we only record it. Above ₹50,000 the truck must carry one.</p>
                      <div className="grid gap-3.5 @xl:grid-cols-3">
                        <TextField label="E-way bill number" inputMode="numeric" placeholder="12 digits" error={errors.ewayNumber?.message} data-after-charges="" {...register("ewayNumber")} />
                        <TextField label="E-way bill date" type="date" error={errors.ewayDate?.message} {...register("ewayDate")} />
                        <TextField label="Vehicle number" placeholder="WB73E1234" error={errors.vehicleNumber?.message} {...register("vehicleNumber")} />
                      </div>
                    </div>
                    {notesAndAttach}
                  </>
                ),
              }
            : {
                id: "notes",
                title: "Tag & notes",
                invalid: Boolean(errors.notes),
                content: (
                  <>
                    {landsOnPurchase ? (
                      <SelectField
                        label="Add this cost to the items of"
                        options={[{ value: NOT_TAGGED, label: "No purchase: a general expense" }, ...purchases.map((purchase) => ({ value: purchase.id, label: purchase.label }))]}
                        value={landedCostFor || NOT_TAGGED}
                        onValueChange={(value) => setValue("landedCostFor", value === NOT_TAGGED ? "" : value)}
                      />
                    ) : (
                      <p className="text-xs font-semibold text-muted">
                        Only charges under a head that lands on item cost (freight inward, unloading, labour) can be added to a purchase&rsquo;s items.
                      </p>
                    )}
                    {notesAndAttach}
                  </>
                ),
              },
        ]}
        actions={
          <>
            <Link href="/purchases" className={buttonClasses("neutral")} tabIndex={-1}>
              Back to bills
            </Link>
            <Button type="submit" disabled={isSubmitting} data-voucher-accept="">
              {isSubmitting ? "Saving…" : "Save bill"}
            </Button>
          </>
        }
        aside={
          <>
            {tax && totals ? (
              <BillTotalsCard totals={totals} tax={tax} />
            ) : (
              <GlassCard className="flex flex-col gap-2">
                <CardTitle>Totals</CardTitle>
                <p className="text-sm font-semibold text-muted">Pick the vendor to see the GST on this bill and what comes back as input credit.</p>
              </GlassCard>
            )}
            {result && step !== 2 && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
          </>
        }
      />
    </form>
  );
}
