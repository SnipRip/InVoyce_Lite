"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { z } from "zod";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { NextNumberChip } from "@/features/number-series/next-number-chip";
import { TextField } from "@/components/ui/text-field";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import { JournalPartyLine } from "./journal-party-line";
import { CASH_RECEIPT_LIMIT } from "@/features/payments/settlements-api";
import { cashFlowsOf, createJournal, journalPreviewPath, settlesOutstanding, sideOf, type JournalLedgerOption } from "./journals-api";

const amount = z.union([z.literal(""), z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "An amount in rupees, like 1250.50")]);
const journalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
  number: z.string().trim().max(30),
  narration: z.string().trim().max(500),
  lines: z
    .array(
      z
        .object({ ledger: z.string().min(1, "Pick a ledger"), debit: amount, credit: amount, side: z.string(), against: z.string() })
        .refine((line) => (Number(line.debit) > 0) !== (Number(line.credit) > 0), { path: ["debit"], message: "A debit or a credit, not both" }),
    )
    .min(2, "Add at least two lines"),
});
type JournalFormValues = z.infer<typeof journalSchema>;

/** Cash over ₹10,000 to one person in a day is not allowed as a business expense (Income-tax Act s.40A(3)); warned, as on payments. */
const CASH_PAYMENT_LIMIT = 10000;

const emptyLine = { ledger: "", debit: "", credit: "", side: "", against: "" };
const round2 = (value: number) => Math.round(value * 100) / 100;

// A journal voucher by hand (client, 12 Nov 2026): debit one ledger, credit
// another, for what no document books. The difference shows as it is typed;
// a voucher only saves when it balances. Bank and cash on it make it a
// contra, payment or receipt (the backend names it).
export function JournalForm({ ledgers, onSaved }: { ledgers: JournalLedgerOption[]; onSaved: () => Promise<void> }) {
  const today = useToday();
  const router = useRouter();
  const [result, setResult] = useState<{ text: string } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<JournalFormValues>({ resolver: zodResolver(journalSchema), defaultValues: { date: "", number: "", narration: "", lines: [emptyLine, emptyLine] } });
  const lines = useFieldArray({ control, name: "lines" });
  const [date, typed] = useWatch({ control, name: ["date", "lines"] });
  const { data: next } = useSWR<{ number: string | null; method: string }>(date ? journalPreviewPath(date) : null, apiGet);
  const numberTyped = next !== undefined && next.method !== "AUTOMATIC";

  useEffect(() => {
    if (today && !getValues("date")) setValue("date", today);
  }, [today, getValues, setValue]);

  const debit = round2((typed ?? []).reduce((sum, line) => sum + (Number(line.debit) || 0), 0));
  const credit = round2((typed ?? []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0));
  const difference = round2(debit - credit);
  const cash = cashFlowsOf(
    (typed ?? []).map((line) => ({ option: ledgers.find((candidate) => candidate.value === line.ledger), debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 })),
  );
  const cashBarred = cash.parties.filter((party) => party.received >= CASH_RECEIPT_LIMIT).map((party) => party.label);
  const cashWarned = [...cash.parties.filter((party) => party.paid > CASH_PAYMENT_LIMIT).map((party) => party.label), ...(cash.paidOther > CASH_PAYMENT_LIMIT ? ["the expense lines"] : [])];
  const options = ledgers.map((option) => ({ value: option.value, label: option.label, detail: option.group }));

  const onSubmit = handleSubmit(
    async (values) => {
      setResult(null);
      if (difference !== 0) {
        setResult({ text: `Debits and credits differ by ${formatRate(Math.abs(difference))}. Make them equal first.` });
        return;
      }
      try {
        const saved = await createJournal({
          date: values.date,
          number: values.number || null,
          narration: values.narration || null,
          lines: values.lines.map((line) => {
            const option = ledgers.find((candidate) => candidate.value === line.ledger)!;
            const figures = { debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 };
            if (option.kind !== "party") return { kind: option.kind, id: option.id, ...figures };
            const side = sideOf(option, line.side);
            const [againstKind, againstId] = line.against.split(":");
            const against = side && settlesOutstanding(side, figures) && againstId ? { kind: againstKind as "INVOICE", documentId: againstId } : null;
            return { kind: option.kind, id: option.id, ...figures, partySide: side, against };
          }),
        });
        await onSaved();
        router.push(`/journals/${saved.id}`);
      } catch (error) {
        setResult({ text: error instanceof ApiError ? error.message : "Could not save. Check the connection and try again." });
      }
    },
    () => setResult({ text: "Some lines need attention. See the ones marked in red." }),
  );

  // One page that fits the screen, as a journal voucher is entered: date and
  // narration on top, the lines below (only they scroll); Ctrl+A saves.
  return (
    <form onSubmit={onSubmit} noValidate className="max-w-[1080px]">
      <VoucherSteps
        heading={
          <>
            <CardTitle>New journal entry</CardTitle>
            <NextNumberChip next={next} />
          </>
        }
        step={0}
        onStepChange={() => {}}
        onAccept={() => void onSubmit()}
        steps={[
          {
            id: "entry",
            title: "Debit and credit",
            invalid: Boolean(errors.date || errors.number || errors.narration || errors.lines),
            // Enter past a filled last line opens a new one; past an empty one it goes to Save.
            onEnterAtEnd: () => {
              const all = getValues("lines");
              const last = all[all.length - 1];
              if (!last?.ledger || lines.fields.length >= 50) return false;
              lines.append(emptyLine, { shouldFocus: false });
              return true;
            },
            content: (
              <>
                <div className="grid items-start gap-3.5 @xl:grid-cols-[180px_200px_minmax(0,1fr)]">
                  <TextField label="Date" type="date" max={today ?? undefined} error={errors.date?.message} {...register("date")} />
                  <TextField
                    label="Number"
                    disabled={!numberTyped}
                    placeholder={next?.number ?? ""}
                    hint={numberTyped ? "Type it, or leave blank for the next" : "Given on save"}
                    error={errors.number?.message}
                    {...register("number")}
                  />
                  <TextField label="Narration" placeholder="Depreciation on the truck for 2026-27" error={errors.narration?.message} {...register("narration")} />
                </div>
                <div className="flex flex-col gap-3 border-t border-line pt-3.5">
                  <div className="hidden grid-cols-[minmax(0,1fr)_140px_140px_40px] gap-2.5 text-xs font-medium text-muted @2xl:grid">
                    <span>Ledger</span>
                    <span className="text-right">Debit ₹</span>
                    <span className="text-right">Credit ₹</span>
                    <span />
                  </div>
                  {lines.fields.map((field, index) => {
                    const lineErrors = errors.lines?.[index];
                    const typedLine = typed?.[index];
                    const option = ledgers.find((candidate) => candidate.value === typedLine?.ledger);
                    return (
                      <div key={field.id} className="flex flex-col gap-1.5">
                      <div className="grid items-start gap-2.5 @2xl:grid-cols-[minmax(0,1fr)_140px_140px_40px]">
                        <Controller
                          control={control}
                          name={`lines.${index}.ledger`}
                          render={({ field: ledger }) => (
                            <ComboField
                              label="Ledger"
                              hideLabel
                              options={options}
                              value={ledger.value}
                              onChange={ledger.onChange}
                              placeholder="Type a ledger, head, bank or party"
                              error={lineErrors?.ledger?.message}
                            />
                          )}
                        />
                        <TextField label="Debit" hideLabel inputMode="decimal" className="text-right" placeholder="Dr" error={lineErrors?.debit?.message} {...register(`lines.${index}.debit`)} />
                        <TextField label="Credit" hideLabel inputMode="decimal" className="text-right" placeholder="Cr" error={lineErrors?.credit?.message} {...register(`lines.${index}.credit`)} />
                        <Button variant="neutral" aria-label="Remove this line" disabled={lines.fields.length <= 2} onClick={() => lines.remove(index)} className="w-10 px-0">
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      {option?.kind === "party" && (
                        <JournalPartyLine
                          option={option}
                          debit={Number(typedLine?.debit) || 0}
                          credit={Number(typedLine?.credit) || 0}
                          side={typedLine?.side ?? ""}
                          onSide={(side) => setValue(`lines.${index}.side`, side)}
                          against={typedLine?.against ?? ""}
                          onAgainst={(value) => setValue(`lines.${index}.against`, value)}
                        />
                      )}
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button variant="outline" onClick={() => lines.append(emptyLine)} disabled={lines.fields.length >= 50}>
                      <Plus aria-hidden="true" />
                      Add a line
                    </Button>
                    <div className="ml-auto grid grid-cols-3 gap-4 text-right text-sm font-semibold tabular-nums">
                      <span>
                        <span className="block text-xs font-medium text-muted">Debits</span>
                        {formatRate(debit)}
                      </span>
                      <span>
                        <span className="block text-xs font-medium text-muted">Credits</span>
                        {formatRate(credit)}
                      </span>
                      <span className={clsx(difference !== 0 ? "text-danger-strong" : "text-success-strong")}>
                        <span className="block text-xs font-medium text-muted">Difference</span>
                        {difference === 0 ? "Balanced" : formatRate(Math.abs(difference))}
                      </span>
                    </div>
                  </div>
                  {errors.lines?.root && <p className="text-xs font-semibold text-danger-strong">{errors.lines.root.message}</p>}
                </div>
                <p className="text-xs font-medium text-muted">
                  A customer or vendor line settles what is outstanding (bad debt written off, discount allowed or received, set-off between their two ledgers) or adds
                  a charge of its own (interest, a bounced cheque), so what they owe always agrees with the books.
                </p>
                {cashBarred.length > 0 && (
                  <p role="alert" className="rounded-(--radius-tile) bg-danger-tint px-4 py-3 text-sm font-semibold text-danger-strong">
                    Cash of ₹2 lakh or more from one person in a day is not allowed (Income-tax Act s.269ST). Received in cash here: {cashBarred.join(", ")}. Take it by bank transfer or cheque.
                  </p>
                )}
                {cashWarned.length > 0 && (
                  <p role="status" className="rounded-(--radius-tile) bg-warning-tint px-4 py-3 text-sm font-semibold text-warning-strong">
                    Cash over ₹10,000 to one person in a day is not allowed as a business expense (Income-tax Act s.40A(3)). Paid in cash here: {cashWarned.join(", ")}. Pay by bank if you can.
                  </p>
                )}
                {result && (
                  <FormMessage tone="error" result={result}>
                    {result.text}
                  </FormMessage>
                )}
              </>
            ),
          },
        ]}
        actions={
          <>
            <Link href="/journals" className={buttonClasses("neutral")} tabIndex={-1}>
              Cancel
            </Link>
            <Button type="submit" disabled={isSubmitting} data-voucher-accept="">
              {isSubmitting ? "Saving…" : "Save the journal"}
            </Button>
          </>
        }
      />
    </form>
  );
}
