"use client";

import { Switch } from "radix-ui";
import { useId, type ReactNode } from "react";

interface SwitchFieldProps {
  label: string;
  /** What on and off do, under the label. */
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

// An on / off setting: label and explanation on the left, the switch on the right.
export function SwitchField({ label, description, checked, onCheckedChange, disabled, id }: SwitchFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="flex items-start justify-between gap-3.5">
      <label htmlFor={fieldId} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </label>
      <Switch.Root
        id={fieldId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </div>
  );
}
