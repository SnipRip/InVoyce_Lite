"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { Tooltip } from "./tooltip";

interface AddButtonProps {
  /** What it adds, read out and shown on hover: "Add a new customer". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

// The "+" at the right end of a picker: opens a small dialog that adds the
// missing record without leaving the entry being made (client, 12 Nov 2026).
export function AddButton({ label, onClick, disabled, className }: AddButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        // Enter in a voucher form walks the fields; this button keeps Enter for itself.
        data-voucher-own-enter=""
        className={clsx(
          "flex size-[34px] shrink-0 items-center justify-center rounded-(--radius-control) border border-line bg-white/70 text-brand-strong transition-colors hover:border-brand hover:bg-brand-tint disabled:pointer-events-none disabled:opacity-40",
          className,
        )}
      >
        <Plus aria-hidden="true" className="size-4" strokeWidth={2.4} />
      </button>
    </Tooltip>
  );
}
