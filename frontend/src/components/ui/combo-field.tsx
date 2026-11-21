"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { advanceFrom, moveFocus } from "@/lib/voucher-focus";
import { AddButton } from "./add-button";
import { fieldClasses, fieldLabelClasses } from "./text-field";

export interface ComboOption {
  value: string;
  label: string;
  /** Smaller text under the label, searched too (GSTIN, SKU, stock). */
  detail?: string;
}

interface ComboFieldProps {
  label: string;
  /** Label for screen readers only, for a cell in a line grid. */
  hideLabel?: boolean;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  /**
   * Enter on the field while nothing is picked or typed. Return true when it
   * did something (a line grid ends its list this way).
   */
  onEmptyEnter?: () => boolean;
  /** Attributes for the input, e.g. data-line-start to find a row's first cell. */
  inputProps?: Record<`data-${string}`, string | boolean>;
  className?: string;
  /** Shows a "+" at the right end that adds a new record; `addLabel` names it. */
  onAdd?: () => void;
  addLabel?: string;
}

/** Shown at once; typing narrows a long list. */
const SHOWN = 50;

const matches = (option: ComboOption, words: string[]) => {
  const text = `${option.label} ${option.detail ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
};

// A searchable single pick, made for the keyboard: type part of a name, ↑ ↓
// to move, Enter picks and goes on to the next field. Esc closes the list
// and puts the picked name back. Used for parties and items on vouchers,
// where a plain dropdown of hundreds of entries is slow.
export function ComboField({ label, hideLabel, options, value, onChange, placeholder, disabled, error, hint, onEmptyEnter, inputProps, className, onAdd, addLabel }: ComboFieldProps) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  /** What is typed; null while showing the picked option's name. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const picked = options.find((option) => option.value === value);
  const found = useMemo(() => {
    const words = (query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? options.filter((option) => matches(option, words)) : options;
  }, [options, query]);
  const shown = found.slice(0, SHOWN);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const pick = (option: ComboOption) => {
    onChange(option.value);
    close();
  };

  const openAt = (index: number) => {
    setOpen(true);
    setActive(Math.max(0, Math.min(index, shown.length - 1)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openAt(Math.max(0, shown.findIndex((option) => option.value === value)));
        else setActive((current) => Math.min(current + 1, shown.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (open) setActive((current) => Math.max(current - 1, 0));
        return;
      case "Escape":
        if (open || query !== null) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
      case "Enter": {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        if (event.shiftKey) {
          close();
          moveFocus(input, -1);
          return;
        }
        if (open && shown[active]) {
          pick(shown[active]);
          // After the pick renders (a unit list may enable), go on.
          setTimeout(() => advanceFrom(input));
          return;
        }
        if (query && found.length === 0) return;
        if (!value && !query && onEmptyEnter?.()) return;
        close();
        advanceFrom(input);
        return;
      }
      case "Tab":
        // A typed search with a match takes it on leaving the field.
        if (open && query && shown[active]) pick(shown[active]);
        return;
    }
  };

  return (
    <div className={clsx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : fieldLabelClasses}>
        {label}
      </label>
      <div className="flex min-w-0 items-start gap-1.5">
      <div className="min-w-0 flex-1">
      <Popover.Root open={open && !disabled} onOpenChange={(next) => !next && close()}>
        <Popover.Anchor asChild>
          <div ref={anchorRef} className="relative">
            <input
              ref={inputRef}
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && shown[active] ? `${id}-option-${active}` : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              placeholder={placeholder ?? "Type to search"}
              value={query ?? picked?.label ?? ""}
              onChange={(event) => {
                setQuery(event.target.value);
                openAt(0);
              }}
              onFocus={(event) => event.target.select()}
              onBlur={close}
              onClick={() => (open ? close() : openAt(Math.max(0, shown.findIndex((option) => option.value === value))))}
              onKeyDown={onKeyDown}
              data-voucher-own-enter=""
              className={clsx(fieldClasses, "pr-8", error && "border-danger")}
              {...inputProps}
            />
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
            }}
            className="z-40 w-[max(var(--radix-popover-trigger-width),280px)] max-w-[min(440px,calc(100vw-32px))] animate-pop-in glass-popover p-1"
          >
            <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
              {shown.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  // Keeps focus in the input, so the pick does not blur it first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    pick(option);
                    inputRef.current?.focus();
                  }}
                  onMouseMove={() => setActive(index)}
                  className={clsx(
                    "cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]",
                    index === active ? "bg-brand-tint text-brand-strong" : "text-ink-soft",
                    option.value === value && "font-semibold text-ink",
                  )}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.detail && <span className="block truncate text-[11.5px] text-muted">{option.detail}</span>}
                </li>
              ))}
            </ul>
            {found.length === 0 && <p className="px-2.5 py-2.5 text-[13px] text-muted">Nothing matches &ldquo;{query}&rdquo;.</p>}
            {found.length > SHOWN && <p className="px-2.5 pt-1 text-[11.5px] text-muted">{found.length - SHOWN} more: type to narrow.</p>}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      </div>
      {onAdd && <AddButton label={addLabel ?? `Add a new ${label.toLowerCase()}`} onClick={onAdd} disabled={disabled} />}
      </div>
      {(error ?? hint) && <p className={clsx("text-[11.5px] font-medium", error ? "text-danger-strong" : "text-muted")}>{error ?? hint}</p>}
    </div>
  );
}
