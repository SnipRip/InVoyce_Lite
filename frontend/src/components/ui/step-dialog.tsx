"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./button";
import { FormMessage } from "./form-message";
import { GlassModal } from "./glass-modal";

export interface DialogStep {
  title: string;
  content: ReactNode;
}

interface StepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Each step holds what fits on one screen; anything more goes to the next step. */
  steps: DialogStep[];
  /** Checks the fields of one step before moving on; false keeps it open with its errors. */
  validateStep: (index: number) => Promise<boolean>;
  /** Saves; throws to show the error under the last step. */
  onSave: () => Promise<void>;
  saveLabel?: string;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : "Could not save. Check the connection and try again.");

// A dialog that asks in short steps, so nothing ever needs scrolling: the
// steps sit along the top, Back / Next along the bottom, Enter goes on. Used
// by the "+" quick-add dialogs on every entry form (client, 12 Nov 2026).
export function StepDialog({ open, onOpenChange, title, description, steps, validateStep, onSave, saveLabel = "Save" }: StepDialogProps) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string } | null>(null);
  const last = index === steps.length - 1;

  const change = (next: boolean) => {
    if (!next) {
      setIndex(0);
      setError(null);
    }
    onOpenChange(next);
  };

  const go = async (target: number) => {
    // Going back never validates; going on checks every step passed over.
    for (let step = index; step < target; step++) {
      if (!(await validateStep(step))) {
        setIndex(step);
        return;
      }
    }
    setError(null);
    setIndex(target);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (!last) return go(index + 1);
    if (!(await validateStep(index))) return;
    setBusy(true);
    setError(null);
    try {
      await onSave();
      change(false);
    } catch (caught) {
      setError({ text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const formId = useId();

  const stepList =
    steps.length > 1 ? (
      <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
        {steps.map((step, position) => (
          <li key={step.title}>
            <button
              type="button"
              onClick={() => (position !== index ? go(position) : undefined)}
              aria-current={position === index ? "step" : undefined}
              className={clsx(
                "inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-colors",
                position === index
                  ? "border-brand bg-brand-tint text-brand-strong"
                  : position < index
                    ? "border-line bg-white/60 text-ink-soft hover:border-brand"
                    : "border-line text-muted hover:border-brand",
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  position < index ? "bg-success text-white" : position === index ? "bg-brand text-white" : "bg-ink/10",
                )}
              >
                {position < index ? <Check className="size-2.5" strokeWidth={3} /> : position + 1}
              </span>
              {step.title}
            </button>
          </li>
        ))}
      </ol>
    ) : undefined;

  const footer = (
    <div onKeyDown={(event) => event.stopPropagation()} className="flex w-full flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted">{steps.length > 1 ? `Step ${index + 1} of ${steps.length} · Enter goes on` : "Enter saves"}</span>
      <div className="flex gap-2">
        {index > 0 ? (
          <Button variant="outline" onClick={() => go(index - 1)} disabled={busy}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        ) : (
          <Button variant="outline" onClick={() => change(false)} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" form={formId} disabled={busy}>
          {last ? (busy ? "Saving…" : saveLabel) : "Next"}
          {!last && <ArrowRight aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );

  // Title and steps stay at the top, Back / Next at the bottom; only the fields scroll.
  return (
    <GlassModal open={open} onOpenChange={change} title={title} description={description} size="medium" toolbar={stepList} footer={footer}>
      {/* Portalled, but React still bubbles events to the voucher form behind: keep them here. */}
      <form id={formId} onSubmit={submit} onKeyDown={(event) => event.stopPropagation()} noValidate className="flex flex-col gap-3.5">
        {/* Every step stays mounted, so what was typed survives Back. */}
        {steps.map((step, position) => (
          <div key={step.title} hidden={position !== index} className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
            {step.content}
          </div>
        ))}

        {error && (
          <FormMessage tone="error" result={error}>
            {error.text}
          </FormMessage>
        )}
      </form>
    </GlassModal>
  );
}
