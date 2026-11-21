"use client";

import { VoucherSteps } from "@/components/ui/voucher-steps";
import { firstStepWithErrors, stepHasErrors } from "@/lib/step-errors";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatInr, formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { BankCashAccountView } from "@/types/bank-cash";
import type { OpenDocumentView, SettlementDirectionView, SettlementView } from "@/types/settlement";
import { AllocationTable } from "./allocation-table";
import { settlementSchema, type SettlementFormValues } from "./settlement-schema";
import { applyOldestFirst, CASH_RECEIPT_LIMIT, createSettlement, MODE_OPTIONS, numberPreviewPath } from "./settlements-api";
import { useQuickAddParty } from "@/features/parties/quick-add-party";
import { defaultAccountFor } from "@/features/masters/money-account-rules";
import { useQuickAddMoneyAccount } from "@/features/masters/quick-add-money-account";

interface SettlementFormProps {
  direction: SettlementDirectionView;
  parties: SelectOption[];
  /** Every document of this direction; the open ones of the picked party are listed. */
  documents: OpenDocumentView[];
  accounts: BankCashAccountView[];
  /** Opened from an invoice's "Record receipt" or a bill's "Pay". */
  initialDocumentId?: string;
  /** After the save: reload what changed. */
  onSaved: (saved: SettlementView) => Promise<void>;
}

const TEXT = {
  RECEIPT: { title: "Record a receipt", party: "Received from", applied: "Apply to invoices", document: "Invoice", submit: "Save receipt", tds: "TDS deducted by the customer (₹)", account: "Into account" },
  PAYMENT: { title: "Pay a vendor", party: "Paid to", applied: "Apply to bills and expenses", document: "Bill or expense", submit: "Save payment", tds: "TDS we deducted (₹)", account: "From account" },
};

/** The fields on each step, to mark a step red and open it on a failed save. */
const STEP_FIELDS = [["partyId", "date", "amount", "accountId", "reference", "tds"], ["allocations", "notes"]] as const;

// Money in from a customer or out to a vendor through a real bank or cash
// account, applied to the party's open invoices or bills (and opening
// balance), oldest first unless changed (auto-apply). What is not
// applied stays as an advance and can be applied later from the entry page.
export function SettlementForm({ direction, parties, documents, accounts, initialDocumentId, onSaved }: SettlementFormProps) {
  const router = useRouter();
  const today = useToday();
  const text = TEXT[direction];
  const initial = documents.find((document) => document.id === initialDocumentId && document.balance > 0);
  const [problem, setProblem] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const openFor = (partyId: string) => documents.filter((document) => document.partyId === partyId && document.balance > 0);
  const rowsFor = (partyId: string, fill?: string) =>
    openFor(partyId).map((document) => ({ kind: document.kind, documentId: document.id, balance: document.balance, amount: document.id === fill ? String(document.balance) : "" }));
  const liveAccounts = accounts.filter((account) => !account.isArchived);
  const firstFor = (mode: string) => defaultAccountFor(liveAccounts, mode);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SettlementFormValues>({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      partyId: initial?.partyId ?? "",
      date: "",
      amount: initial ? String(initial.balance) : "",
      mode: "BANK_TRANSFER",
      accountId: firstFor("BANK_TRANSFER"),
      reference: "",
      tds: "",
      notes: "",
      allocations: initial ? rowsFor(initial.partyId, initial.id) : [],
    },
  });
  const rows = useFieldArray({ control, name: "allocations" });

  useEffect(() => {
    if (today && !getValues("date")) setValue("date", today);
  }, [today, getValues, setValue]);

  const [partyId, date, amount, tds, mode, allocations] = useWatch({ control, name: ["partyId", "date", "amount", "tds", "mode", "allocations"] });
  const addAccount = useQuickAddMoneyAccount({ mode, accounts, onPick: (id) => setValue("accountId", id, { shouldValidate: true }) });
  const { data: nextNumber } = useSWR<{ number: string | null }>(date ? numberPreviewPath(direction, date) : null, apiGet);
  const accountOptions = useMemo(
    () => liveAccounts.filter((account) => (mode === "CASH") === (account.kind === "CASH")).map((account) => ({ value: account.id, label: account.name })),
    [liveAccounts, mode],
  );
  const applied = (allocations ?? []).reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);
  const available = (Number(amount) || 0) + (Number(tds) || 0);
  const byId = new Map(documents.map((document) => [document.id, document]));

  const pickParty = (id: string) => {
    setValue("partyId", id, { shouldValidate: true });
    rows.replace(rowsFor(id));
  };
  const addParty = useQuickAddParty(direction === "RECEIPT" ? "customer" : "vendor", parties.map((option) => option.value), pickParty);
  const pickMode = (next: SettlementFormValues["mode"]) => {
    setValue("mode", next);
    const current = liveAccounts.find((account) => account.id === getValues("accountId"));
    if (!current || (next === "CASH") !== (current.kind === "CASH")) setValue("accountId", firstFor(next), { shouldValidate: true });
  };
  const fillOldestFirst = () => {
    const plan = applyOldestFirst(available, openFor(partyId));
    rows.replace(openFor(partyId).map((document) => ({ kind: document.kind, documentId: document.id, balance: document.balance, amount: plan.has(document.id) ? String(plan.get(document.id)) : "" })));
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setProblem(null);
      try {
        const saved = await createSettlement({
          direction,
          partyId: values.partyId,
          date: values.date,
          accountId: values.accountId,
          mode: values.mode,
          amount: Number(values.amount) || 0,
          tds: Number(values.tds) || 0,
          reference: values.reference || null,
          notes: values.notes || null,
          allocations: values.allocations
            .filter((row) => Number(row.amount) > 0)
            .map((row) => ({ kind: row.kind, documentId: row.documentId, amount: Number(row.amount) })),
        });
        await onSaved(saved);
        router.push(`/payments/entries/${saved.id}`);
      } catch (error) {
        setProblem(error instanceof ApiError ? error.message : "Could not save. Check the connection and try again.");
      }
    },
    (failed) => {
      setStep(firstStepWithErrors(failed, STEP_FIELDS));
      setProblem("Some fields need attention. The step marked red has them.");
    },
  );

  const openRows = rows.fields.map((field) => byId.get(field.documentId)!).filter(Boolean);

  return (
    <form onSubmit={onSubmit} noValidate>
      <VoucherSteps
        heading={
          <>
            <CardTitle>{text.title}</CardTitle>
            <StatusChip tone="neutral">{nextNumber?.number ?? "Number on save"}</StatusChip>
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void onSubmit()}
        steps={[
          {
            id: "money",
            title: "Amount & account",
            invalid: stepHasErrors(errors, STEP_FIELDS[0]),
            content: (
              <>
                <div className="grid gap-3.5 @xl:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <SelectField label={text.party} options={parties} value={partyId || undefined} onValueChange={pickParty} onAdd={addParty.open} addLabel={direction === "RECEIPT" ? "Add a new customer" : "Add a new vendor"} />
                    {addParty.dialog}
                    {errors.partyId && <p className="text-xs font-semibold text-danger-strong">{errors.partyId.message}</p>}
                  </div>
                  <TextField label="Date" type="date" error={errors.date?.message} {...register("date")} />
                </div>
                <div className="grid gap-3.5 @xl:grid-cols-3">
                  <TextField label="Amount (₹)" inputMode="decimal" error={errors.amount?.message} {...register("amount")} />
                  <SelectField label="How" options={MODE_OPTIONS} value={mode} onValueChange={(value) => pickMode(value as SettlementFormValues["mode"])} />
                  <Controller
                    control={control}
                    name="accountId"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1.5">
                        <SelectField
                          label={text.account}
                          options={accountOptions}
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                          onAdd={addAccount.canAdd ? addAccount.open : undefined}
                          addLabel={addAccount.label}
                        />
                        {addAccount.dialog}
                        {(errors.accountId || accountOptions.length === 0) && (
                          <p className="text-xs font-semibold text-danger-strong">
                            {accountOptions.length === 0 ? (
                              <>
                                No {mode === "CASH" ? "cash book" : "bank account"} yet.{" "}
                                <Link href="/masters/bank-cash" className="underline">
                                  Add one in Bank &amp; cash
                                </Link>
                              </>
                            ) : (
                              errors.accountId?.message
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  />
                </div>
                <div className="grid gap-3.5 @xl:grid-cols-2">
                  <TextField label="Reference" placeholder="UTR, cheque or UPI number" error={errors.reference?.message} {...register("reference")} />
                  <TextField label={text.tds} inputMode="decimal" hint="Counts towards settling the documents" error={errors.tds?.message} {...register("tds")} />
                </div>
                {direction === "RECEIPT" && mode === "CASH" && Number(amount) >= CASH_RECEIPT_LIMIT && (
                  <p className="rounded-(--radius-tile) bg-danger-tint px-4 py-3 text-sm font-semibold text-danger-strong">
                    Cash of ₹2 lakh or more from one person in a day is not allowed (Income-tax Act s.269ST). Take it by bank transfer or cheque.
                  </p>
                )}
                {direction === "PAYMENT" && mode === "CASH" && Number(amount) > 10000 && (
                  <p className="rounded-(--radius-tile) bg-warning-tint px-4 py-3 text-sm font-semibold text-warning-strong">
                    Cash over ₹10,000 to one person in a day is not allowed as a business expense (Income-tax Act s.40A(3)). Pay by bank if you can.
                  </p>
                )}
              </>
            ),
          },
          {
            id: "applied",
            title: "Applied to",
            invalid: stepHasErrors(errors, STEP_FIELDS[1]),
            content: (
              <>
                <div className="flex flex-col gap-3.5 border-t border-line pt-3.5 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{text.applied}</CardTitle>
                    <Button variant="outline" onClick={fillOldestFirst} disabled={!partyId || rows.fields.length === 0} className="ml-auto">
                      Apply oldest first
                    </Button>
                  </div>
                  {!partyId ? (
                    <p className="text-sm font-semibold text-muted">Pick the party to see what is open.</p>
                  ) : rows.fields.length === 0 ? (
                    <p className="text-sm font-semibold text-muted">Nothing open. The whole amount is kept as an advance.</p>
                  ) : (
                    <AllocationTable documents={openRows} rowIds={rows.fields.map((field) => field.id)} register={register} errors={errors} today={today} documentWord={text.document} />
                  )}
                </div>
                <TextField label="Notes" error={errors.notes?.message} {...register("notes")} />
              </>
            ),
          },
        ]}
        actions={
          <>
            <Link href="/payments" className={buttonClasses("neutral")} tabIndex={-1}>
              Back to payments
            </Link>
            <Button type="submit" variant={direction === "RECEIPT" ? "success" : "primary"} disabled={isSubmitting} data-voucher-accept="">
              {isSubmitting ? "Saving…" : text.submit}
            </Button>
          </>
        }
        aside={
          <>

            <GlassCard className="flex flex-col gap-2">
              <CardTitle>Summary</CardTitle>
              <dl className="flex flex-col gap-1.5 text-sm font-semibold">
                <Row label="Amount" value={formatRate(Number(amount) || 0)} />
                {Number(tds) > 0 && <Row label="TDS" value={formatRate(Number(tds))} />}
                <Row label="Applied" value={formatRate(applied)} />
                <div className="my-1 border-t border-line" />
                <div className={available - applied < 0 ? "flex justify-between font-semibold text-danger-strong" : "flex justify-between font-semibold"}>
                  <dt>{available - applied < 0 ? "Applied more than received" : "Kept as advance"}</dt>
                  <dd className="tabular-nums">{formatRate(Math.abs(available - applied))}</dd>
                </div>
              </dl>
              {partyId && (
                <p className="text-xs font-semibold text-muted">
                  Open with this party: {formatInr(openFor(partyId).reduce((sum, document) => sum + document.balance, 0))}
                </p>
              )}
            </GlassCard>
            {problem && <FormMessage tone="error">{problem}</FormMessage>}
          </>
        }
      />
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
