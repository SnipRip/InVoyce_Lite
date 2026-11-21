"use client";

import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { focusField } from "@/lib/voucher-focus";

interface LineGridOptions {
  count: number;
  append: () => void;
  remove: (index: number) => void;
  /** Whether a line has its item (or charge) picked: an empty last line ends the list. */
  isFilled: (index: number) => boolean;
  /** Leaves the grid for the next step (Enter on an empty last line). */
  onDone: () => void;
  /** Fewest lines kept (1 for items; 0 for optional freight lines). */
  minimum?: number;
}

/**
 * Keyboard behaviour of a voucher's lines, as in standard books: Enter past the last
 * cell of a filled last line opens a new line; Enter on the empty new line's
 * first cell drops it and moves on; Alt+N adds a line, Alt+X removes the one
 * being typed in. Tracks which line has the focus, for its detail panel.
 */
export function useLineGrid({ count, append, remove, isFilled, onDone, minimum = 1 }: LineGridOptions) {
  // State, not a ref: the grid object is read while rendering.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const focusRow = useCallback((index: number) => {
    focusField(root?.querySelector<HTMLElement>(`[data-line-row="${index}"] [data-line-start]`));
  }, [root]);

  /** Adds a line; it takes the focus once it renders (a click or key press commits before a timeout runs). */
  const add = () => {
    const index = count;
    setActive(index);
    append();
    setTimeout(() => focusRow(index));
  };

  const removeAt = (index: number) => {
    if (count <= minimum) return;
    remove(index);
    const next = Math.max(0, Math.min(index, count - 2));
    setActive(next);
    setTimeout(() => focusRow(next));
  };

  /** For VoucherStep.onEnterAtEnd: a filled last line opens the next one. */
  const enterAtEnd = () => {
    if (!isFilled(count - 1)) return false;
    add();
    return true;
  };

  /** For the first cell's ComboField.onEmptyEnter: an empty last line ends the list. */
  const emptyEnter = (index: number) => {
    if (index !== count - 1 || count <= minimum) return false;
    remove(index);
    setActive(Math.max(0, index - 1));
    onDone();
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      add();
    } else if (key === "x") {
      event.preventDefault();
      removeAt(active);
    }
  };

  const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-line-row]");
    if (row) setActive(Number(row.dataset.lineRow));
  };

  return { attach: setRoot, active, setActive, add, removeAt, enterAtEnd, emptyEnter, onKeyDown, onFocusCapture, count, minimum };
}

export type LineGridState = ReturnType<typeof useLineGrid>;

interface LineGridProps {
  grid: LineGridState;
  /** One stable key per line (useFieldArray's field.id), so removing a line keeps the others' inputs. */
  rowKeys: string[];
  label: string;
  /** CSS grid columns for the cells (the remove button column is added). */
  columns: string;
  headers: { label: string; align?: "right" }[];
  renderRow: (index: number) => ReactNode;
  addLabel: string;
  /** About the line being typed in: stock, HSN, rates offered. Sits under the table. */
  detail?: ReactNode;
}

// The lines of a voucher as a compact table: one row per line, headers once,
// a panel under it for the focused line. Below the container's 3xl width
// each row wraps into a small card.
export function LineGrid({ grid, rowKeys, label, columns, headers, renderRow, addLabel, detail }: LineGridProps) {
  const style = { "--line-columns": `${columns} 36px` } as CSSProperties;
  // Taken apart so the callback ref is not read as the whole object being a ref.
  const { attach, onKeyDown, onFocusCapture, count, minimum, active, add, removeAt } = grid;
  return (
    <div ref={attach} onKeyDown={onKeyDown} onFocusCapture={onFocusCapture} className="flex min-h-0 flex-1 flex-col gap-2.5" style={style}>
      <div role="table" aria-label={label} className="flex min-h-0 flex-col">
        <div role="row" className="hidden gap-2 px-2 pb-1.5 @3xl:grid @3xl:grid-cols-(--line-columns)">
          {headers.map((header) => (
            <span key={header.label} role="columnheader" className={clsx("text-xs font-medium text-muted", header.align === "right" && "text-right")}>
              {header.label}
            </span>
          ))}
          <span role="columnheader" className="sr-only">
            Remove
          </span>
        </div>
        {count === 0 && <p className="px-2 text-xs font-semibold text-muted">None.</p>}
        <div className="flex flex-col gap-1.5">
          {rowKeys.map((rowKey, index) => (
            <div
              key={rowKey}
              role="row"
              data-line-row={index}
              className={clsx(
                "grid items-start gap-2 rounded-(--radius-tile) p-2 @3xl:grid-cols-(--line-columns)",
                index === active ? "glass-inset ring-1 ring-brand/30" : "glass-inset",
              )}
            >
              {renderRow(index)}
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Remove line ${index + 1}`}
                disabled={count <= minimum}
                onClick={() => removeAt(index)}
                className="flex size-[34px] items-center justify-center rounded-md text-muted hover:bg-danger-tint hover:text-danger-strong disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={add}
        className="glass-control glass-press inline-flex h-8 items-center gap-1.5 self-start px-3 text-[12.5px] font-semibold text-brand hover:bg-brand-tint/60"
      >
        <Plus aria-hidden="true" className="size-4" />
        {addLabel}
        <kbd className="ml-1 text-[11px] font-medium text-muted">Alt+N</kbd>
      </button>
      {detail && <div className="mt-auto">{detail}</div>}
    </div>
  );
}
