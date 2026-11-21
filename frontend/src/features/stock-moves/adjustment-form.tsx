"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, buttonClasses } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { firstStepWithErrors, stepHasErrors } from "@/lib/step-errors";
import { SelectField } from "@/components/ui/select-field";
import { StatusChip } from "@/components/ui/status-chip";
import { TextField } from "@/components/ui/text-field";
import type { ItemCatalog } from "@/features/items/item-rules";
import { ApiError } from "@/lib/api-client";
import { useToday } from "@/lib/use-today";
import type { GodownView } from "@/types/item-master";
import type { AdjustmentDirectionView } from "@/types/stock-moves";
import { adjustmentSchema, type AdjustmentFormValues } from "./adjustment-schema";
import { emptyStockLine } from "./stock-line-schema";
import { StockLinesCard } from "./stock-lines-card";
import { DIRECTION_TEXT, reasonsFor } from "./stock-move-rules";
import { createAdjustment } from "./stock-moves-api";
import { GODOWN_BLANK, GODOWN_FIELDS } from "@/features/masters/godowns-master";
import { GODOWNS_PATH, godownPersistence } from "@/features/masters/masters-api";
import { useQuickAddRecord } from "@/features/masters/quick-add-record";

interface AdjustmentFormProps {
  catalog: ItemCatalog;
  /** Active godowns. */
  godowns: GodownView[];
  onSaved: () => Promise<void>;
}

/** The fields on each step, to mark a step red and open it on a failed save. */
const STEP_FIELDS = [["godownId", "reason", "date", "notes"], ["lines"]] as const;

// the usual stock journal for stock that is neither bought nor sold. Taking
// stock out writes it off at what it cost, oldest first; adding stock makes
// a new batch at the cost typed.
export function AdjustmentForm({ catalog, godowns, onSaved }: AdjustmentFormProps) {
  const today = useToday();
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      date: "",
      godownId: (godowns.find((godown) => godown.isDefault) ?? godowns[0])?.id ?? "",
      direction: "OUT",
      reason: "DAMAGED",
      notes: "",
      lines: [emptyStockLine],
    },
  });
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (today && !getValues("date")) setValue("date", today);
  }, [today, getValues, setValue]);

  const [godownId, direction, reason] = useWatch({ control, name: ["godownId", "direction", "reason"] });
  const adding = direction === "IN";
  const godownName = godowns.find((godown) => godown.id === godownId)?.name;

  const pickDirection = (next: AdjustmentDirectionView) => {
    setValue("direction", next);
    // Keep the reason only when it fits the new direction.
    if (!reasonsFor(next).some((option) => option.value === getValues("reason"))) setValue("reason", reasonsFor(next)[0].value);
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setResult(null);
      try {
        const saved = await createAdjustment({
          date: values.date,
          godownId: values.godownId,
          direction: values.direction,
          reason: values.reason,
          notes: values.notes || null,
          lines: values.lines.map((line) => ({
            itemId: line.itemId,
            quantity: Number(line.quantity),
            ...(values.direction === "IN" ? { rate: Number(line.rate) } : {}),
          })),
        });
        await onSaved();
        router.push(`/stock-adjustments/${saved.id}`);
      } catch (error) {
        setResult(error instanceof ApiError ? error.message : "Could not save. Check the connection and try again.");
      }
    },
    (failed) => {
      setStep(firstStepWithErrors(failed, STEP_FIELDS));
      setResult("Some fields need attention. The step marked red has them.");
    },
  );

  const addGodown = useQuickAddRecord({ title: "New godown", fields: GODOWN_FIELDS, blank: GODOWN_BLANK, persistence: godownPersistence(() => {}), path: GODOWNS_PATH, listedIds: godowns.map((godown) => godown.id), onPick: (id) => setValue("godownId", id, { shouldValidate: true }) });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="max-w-[1080px]">
        <VoucherSteps
          heading={
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>New stock adjustment</CardTitle>
                {addGodown.dialog}
                <StatusChip tone="neutral">Numbered on save</StatusChip>
              </div>
            </>
          }
          step={step}
          onStepChange={setStep}
          onAccept={() => void onSubmit()}
          steps={[
            {
              id: "details",
              title: "Godown & reason",
              invalid: stepHasErrors(errors, STEP_FIELDS[0]),
              content: (
                <>
                  <FilterGroup label="Stock is">
                    {(["OUT", "IN"] as const).map((option) => (
                      <FilterChip key={option} selected={direction === option} onClick={() => pickDirection(option)}>
                        {DIRECTION_TEXT[option]}
                      </FilterChip>
                    ))}
                  </FilterGroup>
                  <div className="grid items-start gap-3.5 @xl:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Controller
                        control={control}
                        name="godownId"
                        render={({ field }) => (
                          <SelectField label="Godown" options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))} value={field.value || undefined} onValueChange={field.onChange} onAdd={addGodown.open} addLabel="Add a new godown" />
                        )}
                      />
                      {errors.godownId && <p className="text-xs font-semibold text-danger-strong">{errors.godownId.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Controller
                        control={control}
                        name="reason"
                        render={({ field }) => (
                          <SelectField
                            label="Reason"
                            options={reasonsFor(direction).map((option) => ({ value: option.value, label: option.label }))}
                            value={field.value || undefined}
                            onValueChange={field.onChange}
                          />
                        )}
                      />
                      {errors.reason && <p className="text-xs font-semibold text-danger-strong">{errors.reason.message}</p>}
                    </div>
                    <TextField label="Date" type="date" error={errors.date?.message} {...register("date")} />
                  </div>
                  <TextField
                    label="Notes"
                    placeholder={reason === "OTHER" ? "Say why" : "For us only"}
                    hint={reason === "OTHER" ? undefined : "Optional"}
                    error={errors.notes?.message}
                    {...register("notes")}
                  />
                </>
              ),
            },
            {
              id: "items",
              title: "Items",
              invalid: stepHasErrors(errors, STEP_FIELDS[1]),
              content: (
                <>
                  <StockLinesCard
                    catalog={catalog}
                    godownId={godownId}
                    godownName={godownName}
                    adding={adding}
                    valueHint={
                      adding
                        ? "Stock added comes in at the cost typed, as a new batch that sales draw in date order."
                        : "Stock taken out is written off at what it cost, oldest stock first."
                    }
                  />
                  {result && <FormMessage tone="error">{result}</FormMessage>}
                </>
              ),
            },
          ]}
          actions={
            <>
              <Link href="/stock-adjustments" className={buttonClasses("neutral")} tabIndex={-1}>
                Cancel
              </Link>
              <Button type="submit" variant={adding ? "primary" : "danger"} disabled={isSubmitting} data-voucher-accept="">
                {isSubmitting ? "Saving…" : adding ? "Add the stock" : "Write off the stock"}
              </Button>
            </>
          }
        />
      </form>
    </FormProvider>
  );
}
