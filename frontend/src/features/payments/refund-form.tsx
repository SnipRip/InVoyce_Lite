"use client";

import { VoucherSteps } from "@/components/ui/voucher-steps";
import { firstStepWithErrors, stepHasErrors } from "@/lib/step-errors";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { Button, buttonClasses } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { SelectField } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { BankCashAccountView } from "@/types/bank-cash";
import type { OpenDocumentView, SettlementDirectionView, SettlementView } from "@/types/settlement";
import { AllocationTable } from "./allocation-table";
import { refundSchema, type RefundFormValues } from "./refund-schema";
import { advanceDocument, CASH_RECEIPT_LIMIT, createSettlement, MODE_OPTIONS, numberPreviewPath, openAdvances, REFUND_DIRECTION } from "./settlements-api";
import { defaultAccountFor } from "@/features/masters/money-account-rules";
import { useQuickAddMoneyAccount } from "@/features/masters/quick-add-money-account";

interface RefundFormProps {
  /** Every receipt and payment; the live ones still holding an advance are offered. */
  settlements: SettlementView[];
  /** Live notes still holding the party's credit (credit notes: the customer's; debit notes: ours with the vendor). */
  noteCredits: OpenDocumentView[];
  accounts: BankCashAccountView[];
  /** Opened from an entry's "Refund the advance". */
  initialAdvanceId?: string;
  onSaved: (saved: SettlementView) => Promise<void>;
}

const TEXT = {
  RECEIPT: { chip: "Customer’s advance or credit note", party: "Refund to customer", account: "Paid from account", voucher: "Payment voucher", submit: "Save refund paid" },
  PAYMENT: { chip: "Our advance or debit note with a vendor", party: "Refund from vendor", account: "Received into account", voucher: "Receipt voucher", submit: "Save refund received" },
};

/** The fields on each step, to mark a step red and open it on a failed save. */
const STEP_FIELDS = [["partyId", "date", "accountId", "reference"], ["allocations", "notes"]] as const;

// Gives back what receipts or payments kept as advances: a
// customer's unused advance goes back on a Payment voucher, a vendor's refund
// of ours comes in on a Receipt voucher, each against the advances it clears.
// One refund may clear several advances of the same party.
export function RefundForm({ settlements, noteCredits, accounts, initialAdvanceId, onSaved }: RefundFormProps) {
  const router = useRouter();
  const today = useToday();
  const [problem, setProblem] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  /** What a refund in this direction can give back: advances kept, then note credits, oldest first. */
  const refundables = (kept: SettlementDirectionView): OpenDocumentView[] => [
    ...openAdvances(settlements, kept).map(advanceDocument),
    ...noteCredits.filter((note) => note.kind === (kept === "RECEIPT" ? "CREDIT_NOTE" : "DEBIT_NOTE")),
  ];
  const keptOf = (id?: string): SettlementDirectionView | undefined =>
    (["RECEIPT", "PAYMENT"] as const).find((kept) => refundables(kept).some((row) => row.id === id));
  const initialKept = keptOf(initialAdvanceId);
  const initial = initialKept ? refundables(initialKept).find((row) => row.id === initialAdvanceId) : undefined;
  const liveAccounts = accounts.filter((account) => !account.isArchived);
  const firstFor = (mode: string) => defaultAccountFor(liveAccounts, mode);
  const rowsFor = (kept: SettlementDirectionView, partyId: string, fill?: string) =>
    refundables(kept)
      .filter((row) => row.partyId === partyId)
      .map((row) => ({ kind: row.kind, documentId: row.id, balance: row.balance, amount: row.id === fill ? String(row.balance) : "" }));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RefundFormValues>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      kept: initialKept ?? "RECEIPT",
      partyId: initial?.partyId ?? "",
      date: "",
      mode: "BANK_TRANSFER",
      accountId: firstFor("BANK_TRANSFER"),
      reference: "",
      notes: "",
      allocations: initial && initialKept ? rowsFor(initialKept, initial.partyId, initial.id) : [],
    },
  });
  const rows = useFieldArray({ control, name: "allocations" });

  useEffect(() => {
    if (today && !getValues("date")) setValue("date", today);
  }, [today, getValues, setValue]);

  const [kept, partyId, date, mode, allocations] = useWatch({ control, name: ["kept", "partyId", "date", "mode", "allocations"] });
  const addAccount = useQuickAddMoneyAccount({ mode, accounts, onPick: (id) => setValue("accountId", id, { shouldValidate: true }) });
  const direction = REFUND_DIRECTION[kept];
  const text = TEXT[kept];
  const { data: nextNumber } = useSWR<{ number: string | null }>(date ? numberPreviewPath(direction, date) : null, apiGet);
  const open = refundables(kept);
  const partyOptions = [...new Map(open.map((row) => [row.partyId, { value: row.partyId, label: row.partyName }])).values()];
  const accountOptions = liveAccounts.filter((account) => (mode === "CASH") === (account.kind === "CASH")).map((account) => ({ value: account.id, label: account.name }));
  const byId = new Map(open.map((row) => [row.id, row]));
  const total = (allocations ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const partyName = partyOptions.find((option) => option.value === partyId)?.label ?? "the party";
  const accountName = accountOptions.find((option) => option.value === getValues("accountId"))?.label ?? "the account";

  const pickKept = (next: SettlementDirectionView) => {
    setValue("kept", next);
    setValue("partyId", "");
    rows.replace([]);
  };
  const pickParty = (id: string) => {
    setValue("partyId", id);
    rows.replace(rowsFor(kept, id));
  };
  const pickMode = (next: RefundFormValues["mode"]) => {
    setValue("mode", next);
    const current = liveAccounts.find((account) => account.id === getValues("accountId"));
    if (!current || (next === "CASH") !== (current.kind === "CASH")) setValue("accountId", firstFor(next), { shouldValidate: true });
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setProblem(null);
      const chosen = values.allocations.filter((row) => Number(row.amount) > 0).map((row) => ({ kind: row.kind, documentId: row.documentId, amount: Number(row.amount) }));
      try {
        const saved = await createSettlement({
          direction: REFUND_DIRECTION[values.kept],
          partyId: values.partyId,
          date: values.date,
          accountId: values.accountId,
          mode: values.mode,
          amount: Math.round(chosen.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
          tds: 0,
          reference: values.reference || null,
          brcNumber: null,
          brcDate: null,
          notes: values.notes || null,
          allocations: chosen,
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

  const rowsProblem = errors.allocations?.message ?? errors.allocations?.root?.message;
  const openRows = rows.fields.map((field) => byId.get(field.documentId)).filter((row): row is OpenDocumentView => Boolean(row));

  return (
    <form onSubmit={onSubmit} noValidate>
      <VoucherSteps
        heading={
          <>
            <CardTitle>Refund an advance</CardTitle>
            <StatusChip tone="neutral">{nextNumber?.number ?? "Number on save"}</StatusChip>
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void onSubmit()}
        steps={[
          {
            id: "money",
            title: "Who & how",
            invalid: stepHasErrors(errors, STEP_FIELDS[0]),
            content: (
              <>
                <FilterGroup label="Whose advance">
                  {(["RECEIPT", "PAYMENT"] as const).map((option) => (
                    <FilterChip key={option} selected={kept === option} onClick={() => pickKept(option)}>
                      {TEXT[option].chip}
                    </FilterChip>
                  ))}
                </FilterGroup>
                <div className="grid gap-3.5 @xl:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <SelectField label={text.party} options={partyOptions} value={partyId || undefined} onValueChange={pickParty} />
                    {partyOptions.length === 0 && <p className="text-xs font-semibold text-muted">No {kept === "RECEIPT" ? "customer" : "vendor"} has an advance or note credit left.</p>}
                    {errors.partyId && <p className="text-xs font-semibold text-danger-strong">{errors.partyId.message}</p>}
                  </div>
                  <TextField label="Date" type="date" error={errors.date?.message} {...register("date")} />
                </div>
                <div className="grid gap-3.5 @xl:grid-cols-3">
                  <SelectField label="How" options={MODE_OPTIONS} value={mode} onValueChange={(value) => pickMode(value as RefundFormValues["mode"])} />
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
                  <TextField label="Reference" placeholder="UTR, cheque or UPI number" error={errors.reference?.message} {...register("reference")} />
                </div>
                {direction === "RECEIPT" && mode === "CASH" && total >= CASH_RECEIPT_LIMIT && (
                  <p className="rounded-(--radius-tile) bg-danger-tint px-4 py-3 text-sm font-semibold text-danger-strong">
                    Cash of ₹2 lakh or more from one person in a day is not allowed (Income-tax Act s.269ST). Take it by bank transfer or cheque.
                  </p>
                )}
              </>
            ),
          },
          {
            id: "advances",
            title: "Advances",
            invalid: stepHasErrors(errors, STEP_FIELDS[1]),
            content: (
              <>
                <div className="flex flex-col gap-3.5 border-t border-line pt-3.5 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Advances and note credits refunded</CardTitle>
                    <Button
                      variant="outline"
                      className="ml-auto"
                      disabled={rows.fields.length === 0}
                      onClick={() => rows.replace(rows.fields.map((field) => ({ kind: field.kind, documentId: field.documentId, balance: field.balance, amount: String(field.balance) })))}
                    >
                      Refund all
                    </Button>
                  </div>
                  {!partyId ? (
                    <p className="text-sm font-semibold text-muted">Pick the party to see the advances and note credits it holds.</p>
                  ) : (
                    <AllocationTable documents={openRows} rowIds={rows.fields.map((field) => field.id)} register={register} errors={errors} today={today} documentWord={kept === "RECEIPT" ? "Receipt / note" : "Payment / note"} applyWord="Refund" />
                  )}
                  {rowsProblem && <FormMessage tone="error">{rowsProblem}</FormMessage>}
                </div>
                <TextField label="Notes" placeholder="Order cancelled; balance returned" error={errors.notes?.message} {...register("notes")} />
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
                <div className="flex justify-between">
                  <dt>{direction === "PAYMENT" ? "Refund paid" : "Refund received"}</dt>
                  <dd className="tabular-nums">{formatRate(total)}</dd>
                </div>
              </dl>
              <p className="text-xs font-semibold text-muted">
                {text.voucher}:{" "}
                {direction === "PAYMENT" ? `Dr ${partyName}, Cr ${accountName}` : `Dr ${accountName}, Cr ${partyName}`}. Advances for goods carry no GST, so nothing is reversed.
              </p>
            </GlassCard>
            {problem && <FormMessage tone="error">{problem}</FormMessage>}
          </>
        }
      />
    </form>
  );
}
