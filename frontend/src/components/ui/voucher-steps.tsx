"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Keyboard } from "lucide-react";
import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { focusFirstField, moveFocus, VOUCHER_END_EVENT } from "@/lib/voucher-focus";
import { Popover } from "radix-ui";
import { Button } from "./button";
import { GlassSurface } from "./glass-surface";

export interface VoucherStep {
  id: string;
  title: string;
  /** One line under the title once the step has something, e.g. the customer picked. */
  summary?: string;
  /** Some field on this step failed validation. */
  invalid?: boolean;
  content: ReactNode;
  /** Enter on the step's last field. Return true when handled (a line grid adds a line). */
  onEnterAtEnd?: () => boolean;
}

interface VoucherStepsProps {
  /** Card heading and chips, left of the steps. */
  heading: ReactNode;
  steps: VoucherStep[];
  step: number;
  onStepChange: (step: number) => void;
  /** Ctrl+A, Ctrl+S or Ctrl+Enter: save from any step. */
  onAccept: () => void;
  /** Buttons on the last step; the one to press on Enter carries data-voucher-accept. */
  actions: ReactNode;
  /** Totals and the like, beside the steps on wide screens. */
  aside?: ReactNode;
}

const KEYS: [string, string][] = [
  ["Enter", "next field"],
  ["Shift+Enter", "previous field"],
  ["PgDn / PgUp", "next / previous step"],
  ["Alt+1…", "go to a step"],
  ["Esc", "previous step"],
  ["Alt+N / Alt+X", "add / remove a line"],
  ["Ctrl+A or Ctrl+S", "save"],
];

const popoverOpen = () => Boolean(document.querySelector("[data-radix-popper-content-wrapper]"));

// A voucher entered in steps that each fit the screen, worked from the
// keyboard the usual way: Enter walks the fields and moves to the next
// step after the last one; Ctrl+A accepts. Every step stays mounted (only
// hidden), so nothing typed is lost moving back and forth.
export function VoucherSteps({ heading, steps, step, onStepChange, onAccept, actions, aside }: VoucherStepsProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const last = steps.length - 1;
  const current = steps[step];

  const go = useCallback((next: number) => onStepChange(Math.max(0, Math.min(next, last))), [onStepChange, last]);

  // The open step's first field takes the keyboard (the step is shown by the time effects run).
  useEffect(() => {
    focusFirstField(bodyRef.current?.querySelector(`[data-voucher-step="${steps[step]?.id}"]`) ?? null);
    // Only when the step changes, not on every keystroke's new step list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /** Past the step's last field: the step's own rule, then the next step, then the save button. */
  const atEnd = useCallback(() => {
    if (current?.onEnterAtEnd?.()) return;
    if (step < last) go(step + 1);
    else bodyRef.current?.closest("form")?.querySelector<HTMLElement>("[data-voucher-accept]")?.focus();
  }, [current, step, last, go]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onEnd = () => atEnd();
    body.addEventListener(VOUCHER_END_EVENT, onEnd);
    return () => body.removeEventListener(VOUCHER_END_EVENT, onEnd);
  }, [atEnd]);

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    const inTextArea = target instanceof HTMLTextAreaElement;

    if (ctrl && !event.altKey && (key === "s" || key === "S" || key === "Enter" || ((key === "a" || key === "A") && !inTextArea))) {
      event.preventDefault();
      event.stopPropagation();
      onAccept();
      return;
    }
    if (event.altKey && !ctrl && /^[1-9]$/.test(key) && Number(key) <= steps.length) {
      event.preventDefault();
      go(Number(key) - 1);
      return;
    }
    if ((key === "PageDown" || key === "PageUp") && !popoverOpen()) {
      event.preventDefault();
      go(step + (key === "PageDown" ? 1 : -1));
      return;
    }
    if (key === "Escape") {
      if (popoverOpen() || target.getAttribute("aria-expanded") === "true" || step === 0) return;
      event.preventDefault();
      go(step - 1);
      return;
    }
    if (key === "Enter" && !ctrl && !event.altKey) {
      // Text areas take new lines, buttons click, open lists pick, pickers move themselves.
      if (inTextArea || target.hasAttribute("data-voucher-own-enter") || target.getAttribute("aria-expanded") === "true") return;
      if (target instanceof HTMLButtonElement && target.getAttribute("role") !== "combobox") return;
      if (!target.closest("[data-voucher-step]")) return;
      event.preventDefault();
      event.stopPropagation();
      if (!moveFocus(target, event.shiftKey ? -1 : 1) && !event.shiftKey) atEnd();
    }
  };

  return (
    <div className={clsx("grid items-start gap-3.5 xl:h-[calc(var(--screen-h)-100px)]", aside && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
      <GlassSurface as="div" onKeyDownCapture={onKeyDownCapture} className="@container flex min-w-0 flex-col xl:h-full xl:min-h-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-line px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{heading}</div>
          <ol aria-label="Steps" className="ml-auto flex flex-wrap items-center gap-1.5">
            {steps.map((candidate, index) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => go(index)}
                  className={clsx(
                    "flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-[12.5px] transition-colors",
                    index === step ? "glass-selected font-semibold text-ink" : "font-medium text-muted hover:bg-white/50 hover:text-ink",
                  )}
                >
                  <span
                    className={clsx(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      candidate.invalid ? "bg-danger text-white" : index === step ? "bg-brand text-white" : "bg-ink/8 text-ink-soft",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span>{candidate.title}</span>
                    {candidate.summary && <span className="max-w-40 truncate text-[11px] font-medium text-muted">{candidate.summary}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col xl:overflow-y-auto">
          {steps.map((candidate, index) => (
            <section
              key={candidate.id}
              data-voucher-step={candidate.id}
              aria-label={candidate.title}
              hidden={index !== step}
              className="flex flex-1 flex-col gap-3.5 p-4"
            >
              {candidate.content}
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-4 py-3">
          <Button variant="neutral" disabled={step === 0} onClick={() => go(step - 1)} tabIndex={-1}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Button>
          <Popover.Root>
            <Popover.Trigger
              tabIndex={-1}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Keyboard aria-hidden="true" className="size-4" />
              <span className="max-sm:hidden">Enter: next · PgDn: next step · Ctrl+A: save</span>
              <span className="sm:hidden">Keys</span>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content side="top" align="start" sideOffset={6} className="z-40 animate-pop-in glass-popover p-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                  {KEYS.map(([keys, what]) => (
                    <div key={keys} className="contents">
                      <dt className="font-semibold text-ink">{keys}</dt>
                      <dd className="text-ink-soft">{what}</dd>
                    </div>
                  ))}
                </dl>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {step < last ? (
              <Button onClick={() => go(step + 1)}>
                Next: {steps[step + 1].title}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : (
              actions
            )}
          </div>
        </div>
      </GlassSurface>
      {aside && <div className="flex flex-col gap-3.5 xl:h-full xl:min-h-0 xl:overflow-y-auto">{aside}</div>}
    </div>
  );
}
