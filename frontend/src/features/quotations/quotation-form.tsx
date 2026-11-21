"use client";

import { SelectField } from "@/components/ui/select-field";
import { billedAs, billingOptions, branchIdOf, MAIN_BRANCH } from "@/features/parties/party-branches";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import useSWR from "swr";
import { useDebounceValue } from "usehooks-ts";
import { z } from "zod";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { useLineGrid } from "@/components/ui/line-grid";
import { StatusChip } from "@/components/ui/status-chip";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { GstApplicableToggle } from "@/features/gst/gst-applicable-toggle";
import { chargesGst } from "@/features/gst/gst-rules";
import { gstRateToSend, isGstRateText, withoutGst, type LineGstContext } from "@/features/gst/line-gst-rate";
import { hsnRateText, itemLabel, type ItemCatalog } from "@/features/items/item-rules";
import { ratePerUnit, restateRate } from "@/features/items/line-units";
import { placeOf } from "@/features/parties/party-rules";
import type { Party } from "@/features/parties/types";
import { profitOf } from "@/features/profit/profit-rules";
import { toLineRateOptions, type LineRateOptions } from "@/features/rates/line-rate-options";
import { SaleLineGrid } from "@/features/rates/sale-line-grid";
import { EMPTY_SALE_LINE, saleLineFactor, saleLineRow, schemeRequest, withSchemes, type SaleLineRow } from "@/features/rates/sale-line-row";
import { fetchLineOptions, LINE_OPTIONS_PATH } from "@/features/rates/rates-api";
import { EVALUATE_SCHEMES_PATH, fetchSchemeResult } from "@/features/schemes/schemes-api";
import { ApiError } from "@/lib/api-client";
import { addDays } from "@/lib/dates";
import { formatDate, formatQuantity } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { QuotationView } from "@/types/quotation";
import { DEFAULT_TERMS, previewTotals, quotationTax } from "./quotation-rules";
import { QuotationTotalsCard } from "./quotation-totals-card";
import { createQuotation, reviseQuotation, type QuotationBody } from "./quotations-api";
import type { OurRegistration } from "@/types/company";
import { useQuickAddParty } from "@/features/parties/quick-add-party";

const decimal = (decimals: number, message: string) => z.string().trim().regex(new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`), message);

const schema = z.object({
  partyId: z.string().min(1, "Pick the customer"),
  /** The customer's branch quoted to; MAIN_BRANCH = its main branch. */
  billToBranch: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the validity date"),
  gstApplicable: z.boolean(),
  terms: z.string().max(1500),
  notes: z.string().max(300),
  note: z.string().max(200),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1, "Pick an item"),
        /** One of the item's units; blank = the base unit. */
        unit: z.string(),
        quantity: decimal(3, "Enter the quantity").refine((value) => Number(value) > 0, "More than 0"),
        rate: decimal(2, "Enter the rate"),
        discountPct: z.union([z.literal(""), decimal(2, "0 to 99")]).refine((value) => !value || Number(value) < 100, "0 to 99"),
        /** "" = the item's HSN rate. */
        gstRatePct: z.string().refine(isGstRateText, "0 to 100"),
      }),
    )
    .min(1, "Add at least one item"),
});
type QuotationFormValues = z.infer<typeof schema>;

interface QuotationFormProps {
  customers: Party[];
  catalog: ItemCatalog;
  company: OurRegistration;
  /** Revising this saved quotation: its lines come in, and a note is asked for. */
  revising?: QuotationView;
  /** From Rate enquiry: customer and item quantities. Rates are worked out here. */
  initial?: { partyId?: string; lines: { itemId: string; quantity: number }[] };
  onSaved: () => Promise<void>;
}

const emptyLine = EMPTY_SALE_LINE;

/** The step each field is on, to open the first step with an error. */
const stepOfErrors = (errors: FieldErrors<QuotationFormValues>) => (errors.partyId || errors.date || errors.validUntil || errors.note ? 0 : errors.lines ? 1 : 2);

// A quotation, in three steps that each fit the screen: customer, items,
// terms. Picking an item fills the customer's special rate, else today's
// rate; the focused line shows the last rate quoted with margins. Any rate
// can be typed; going below the day's minimum is flagged. GST % comes from
// the item's HSN and can be changed unless the company setting forbids it;
// the whole quotation can be marked "GST not applicable". The backend
// prices every line again on save.
export function QuotationForm({ customers, catalog, company, revising, initial, onSaved }: QuotationFormProps) {
  const today = useToday();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuotationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partyId: revising?.partyId ?? initial?.partyId ?? "",
      billToBranch: revising?.billTo?.id ?? MAIN_BRANCH,
      date: "",
      validUntil: "",
      gstApplicable: revising ? revising.gstApplicable : chargesGst(company),
      terms: revising ? (revising.terms ?? "") : DEFAULT_TERMS,
      notes: revising?.notes ?? "",
      note: "",
      lines: revising
        ? revising.lines.map((line) => ({
            itemId: line.itemId,
            unit: line.entered.unit,
            quantity: String(line.entered.quantity),
            rate: String(line.entered.rate),
            discountPct: line.discountPct ? String(line.discountPct) : "",
            gstRatePct: revising.gstApplicable ? String(line.gstRatePct) : "",
          }))
        : initial?.lines.length
          ? initial.lines.map((line) => ({ ...emptyLine, itemId: line.itemId, quantity: String(line.quantity), gstRatePct: hsnRateText(catalog, line.itemId) }))
          : [emptyLine],
    },
  });
  const lineFields = useFieldArray({ control, name: "lines" });

  // The date is only known in the browser (see useToday).
  useEffect(() => {
    if (!today || getValues("date")) return;
    setValue("date", today);
    setValue("validUntil", addDays(today, 7));
  }, [today, getValues, setValue]);

  const [partyId, date, lines, gstApplicable, billToBranch] = useWatch({ control, name: ["partyId", "date", "lines", "gstApplicable", "billToBranch"] });
  const customer = customers.find((candidate) => candidate.id === partyId);
  // Quoted to a branch: its GSTIN and state decide the tax.
  const party = customer ? billedAs(customer, billToBranch) : undefined;
  const billToOptions = billingOptions(customer);
  const gst: LineGstContext = { enforce: company.enforceHsnGstRate === true, applicable: gstApplicable };
  const partyTax = party ? quotationTax(company, party) : undefined;
  const tax = partyTax && !gstApplicable ? withoutGst(partyTax, "sale") : partyTax;

  // Every item's rate options in one call (special, today's, last quoted, costs).
  const itemIds = useMemo(() => [...new Set((lines ?? []).map((line) => line.itemId).filter(Boolean))].sort(), [lines]);
  const optionsKey = date && itemIds.length ? ([LINE_OPTIONS_PATH, partyId || undefined, date, itemIds, revising?.id] as const) : null;
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
      const views = await fetchLineOptions([LINE_OPTIONS_PATH, customerId, day, [...new Set(wanted.map((row) => row.itemId))], revising?.id]);
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

  // Lines carried over from Rate enquiry get their rates once the date is known.
  useEffect(() => {
    if (!date || revising || !initial?.lines.length) return;
    void suggest(initial.lines.map((_, index) => index), initial.partyId);
    // Once, when the date first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(date)]);

  const pickParty = (id: string) => {
    setValue("partyId", id, { shouldValidate: true });
    setValue("billToBranch", MAIN_BRANCH);
    // A new customer brings their own special rates and history.
    void suggest(getValues("lines").map((_, index) => index), id);
  };
  const addCustomer = useQuickAddParty("customer", customers.map((candidate) => candidate.id), pickParty);
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
  const totals = previewTotals(priced, tax?.regime ?? "intra-state");
  const schemeTotal = Math.round(priced.reduce((sum, row) => sum + row.schemeDiscount, 0) * 100) / 100;
  // marginCost is per line unit (scaled); free units come back in base units.
  const cost = priced.reduce((sum, row) => sum + ((row.options?.marginCost ?? 0) / row.factor) * (row.base.quantity + row.freeQuantity), 0);
  const profit = profitOf(totals.taxable, cost, 0);
  const costMissing = priced.some((row) => row.options && row.options.marginCost === undefined);

  const grid = useLineGrid({
    count: lineFields.fields.length,
    append: () => lineFields.append(emptyLine, { shouldFocus: false }),
    remove: lineFields.remove,
    isFilled: (index) => Boolean(getValues(`lines.${index}.itemId`)),
    onDone: () => setStep(2),
  });

  const submit = (status: "DRAFT" | "SENT") =>
    handleSubmit(
      async (values) => {
        setResult(null);
        if (revising && values.note.trim().length < 2) {
          setError("note", { message: "Say why it is revised" });
          setStep(0);
          return;
        }
        const context = { enforce: gst.enforce, applicable: values.gstApplicable };
        const body: QuotationBody = {
          partyId: values.partyId,
          billToBranchId: branchIdOf(values.billToBranch),
          date: values.date,
          validUntil: values.validUntil,
          status,
          terms: values.terms.trim() || null,
          notes: values.notes.trim() || null,
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
          const saved = revising ? await reviseQuotation(revising.id, { ...body, note: values.note.trim() }) : await createQuotation(body);
          await onSaved();
          router.push(`/quotations/${saved.id}`);
        } catch (error) {
          setResult({ tone: "error", text: error instanceof ApiError ? error.message : "Could not save. Check the connection and try again." });
        }
      },
      (failed) => {
        setStep(stepOfErrors(failed));
        setResult({ tone: "error", text: "Some fields need attention. The step marked red has them." });
      },
    );

  const customerOptions = customers.map((candidate) => ({
    value: candidate.id,
    label: candidate.displayName,
    detail: [placeOf(candidate), candidate.gstin].filter(Boolean).join(" · "),
  }));
  const itemOptions = catalog.items.map((item) => ({ value: item.id, label: itemLabel(item), detail: item.sku ?? undefined }));
  const filledLines = (lines ?? []).filter((line) => line.itemId).length;

  return (
    <form onSubmit={submit("SENT")} noValidate>
      <VoucherSteps
        heading={
          <>
            <CardTitle>{revising ? `Revise ${revising.number}` : "New quotation"}</CardTitle>
            <StatusChip tone="neutral">{revising ? `Becomes R${revising.revision + 1}` : "Numbered on save"}</StatusChip>
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void submit("SENT")()}
        steps={[
          {
            id: "customer",
            title: "Customer",
            summary: party?.displayName,
            invalid: Boolean(errors.partyId || errors.date || errors.validUntil || errors.note),
            content: (
              <>
                <div className="grid gap-3.5 @xl:grid-cols-[minmax(0,2fr)_1fr_1fr]">
                  <ComboField
                    label="Customer"
                    options={customerOptions}
                    value={partyId}
                    onChange={pickParty}
                    onAdd={addCustomer.open}
                    addLabel="Add a new customer"
                    disabled={Boolean(revising)}
                    error={errors.partyId?.message}
                    placeholder="Type a customer name"
                    hint={party ? `${party.gstin ? `GSTIN ${party.gstin}` : "No GSTIN"} · ${placeOf(party)}` : undefined}
                  />
                  {addCustomer.dialog}
                  <TextField label="Date" type="date" error={errors.date?.message} {...register("date")} />
                  <TextField label="Valid till" type="date" hint="A week by default" error={errors.validUntil?.message} {...register("validUntil")} />
                </div>
                {billToOptions.length > 1 && (
                  <SelectField label="Quote to (branch)" options={billToOptions} value={billToBranch} onValueChange={(value) => setValue("billToBranch", value)} />
                )}
                <GstApplicableToggle
                  value={gstApplicable}
                  onChange={(value) => setValue("gstApplicable", value)}
                  lockedReason={chargesGst(company) ? undefined : "We charge no GST (company registration): quotations carry none."}
                />
                {tax && (
                  <div className="glass-inset rounded-(--radius-tile) px-4 py-3">
                    <p className="text-sm font-semibold">{tax.title}</p>
                    <p className="text-xs font-semibold text-ink-soft">{tax.detail}</p>
                  </div>
                )}
                {revising && (
                  <TextField label="Why it is revised" placeholder="Customer asked for a sharper TMT rate" error={errors.note?.message} {...register("note")} />
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
                {errors.lines?.root?.message && <p className="text-xs font-semibold text-danger-strong">{errors.lines.root.message}</p>}
                <SaleLineGrid
                  grid={grid}
                  rowKeys={lineFields.fields.map((field) => field.id)}
                  lines={lines ?? []}
                  rows={rows}
                  priced={priced}
                  itemOptions={itemOptions}
                  gst={gst}
                  regime={tax?.regime ?? "intra-state"}
                  registerLine={(index, field) => register(`lines.${index}.${field}`)}
                  errorOf={(index, field) => errors.lines?.[index]?.[field]?.message}
                  onPickItem={pickItem}
                  onPickUnit={pickUnit}
                  onPickRate={pickRate}
                  stockOf={(row) => ({ text: `Stock ${formatQuantity(row.item.stock)} ${row.baseUnit}`, short: false })}
                />
              </>
            ),
          },
          {
            id: "terms",
            title: "Terms",
            invalid: Boolean(errors.terms || errors.notes),
            content: (
              <>
                <TextArea label="Terms and conditions" rows={6} error={errors.terms?.message} {...register("terms")} />
                <TextField label="Notes for the customer" error={errors.notes?.message} {...register("notes")} />
                {result && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
                <p className="text-xs font-semibold text-muted">A saved quotation counts as given to the customer and becomes its &ldquo;last quoted&rdquo; rate; a draft does not.</p>
              </>
            ),
          },
        ]}
        actions={
          <>
            <Link href={revising ? `/quotations/${revising.id}` : "/quotations"} className={buttonClasses("neutral")} tabIndex={-1}>
              Cancel
            </Link>
            <Button variant="neutral" disabled={isSubmitting} onClick={submit("DRAFT")}>
              Save as draft
            </Button>
            <Button type="submit" disabled={isSubmitting} data-voucher-accept="">
              {isSubmitting ? "Saving…" : revising ? `Save revision R${revising.revision + 1}` : "Save quotation"}
            </Button>
          </>
        }
        aside={
          <>
            <QuotationTotalsCard totals={totals} tax={tax} schemeDiscount={schemeTotal} profit={profit} costMissing={costMissing} />
            {result && step !== 2 && <FormMessage tone={result.tone} result={result}>{result.text}</FormMessage>}
          </>
        }
      />
    </form>
  );
}
