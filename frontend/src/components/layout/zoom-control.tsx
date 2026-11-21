"use client";

import clsx from "clsx";
import { Minus, Plus, ZoomIn } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect } from "react";
import { ZOOM_LEVELS, zoomLabel } from "@/lib/display-zoom";
import { useDisplayZoom } from "@/lib/use-display-zoom";

const isMac = () => typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

/** − / level / + with the levels to pick from; shared by the top bar and Settings. */
export function ZoomStepper({ className }: { className?: string }) {
  const { zoom, setZoom, zoomIn, zoomOut, reset } = useDisplayZoom();
  const stepButton = "glass-control glass-press flex size-8 items-center justify-center text-ink hover:bg-neutral-tint/60 disabled:opacity-45";
  return (
    <div className={clsx("flex flex-col gap-2.5", className)}>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Make everything smaller" onClick={zoomOut} disabled={zoom <= ZOOM_LEVELS[0]} className={stepButton}>
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <output aria-live="polite" className="min-w-14 text-center text-[15px] font-semibold tabular-nums">
          {zoomLabel(zoom)}
        </output>
        <button type="button" aria-label="Make everything larger" onClick={zoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} className={stepButton}>
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button type="button" onClick={reset} disabled={zoom === 1} className="ml-1 text-xs font-semibold text-brand hover:underline disabled:text-muted disabled:no-underline">
          Reset
        </button>
      </div>
      <div role="radiogroup" aria-label="Zoom level" className="flex flex-wrap gap-1">
        {ZOOM_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={Math.abs(level - zoom) < 0.001}
            onClick={() => setZoom(level)}
            className={clsx(
              "h-7 rounded-full border px-2.5 text-[12px] font-semibold tabular-nums transition-colors",
              Math.abs(level - zoom) < 0.001 ? "border-brand bg-brand-tint text-brand-strong" : "border-line text-ink-soft hover:border-brand",
            )}
          >
            {zoomLabel(level)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Top-bar button: the current zoom, a popover to change it, and the keys
// Ctrl+Alt+= / Ctrl+Alt+- / Ctrl+Alt+0 from any screen. The browser's own
// Ctrl+= stays as it is.
export function ZoomControl() {
  const { zoom, zoomIn, zoomOut, reset } = useDisplayZoom();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.altKey) return;
      if (event.key === "=" || event.key === "+") zoomIn();
      else if (event.key === "-" || event.key === "_") zoomOut();
      else if (event.key === "0") reset();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, reset]);

  const keys = isMac() ? "⌘⌥" : "Ctrl+Alt+";
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Dashboard zoom, now ${zoomLabel(zoom)}`}
        className="glass-control glass-press flex h-8 shrink-0 items-center gap-1 px-2 text-[12px] font-semibold text-ink-soft tabular-nums hover:bg-neutral-tint/60 hover:text-ink"
      >
        <ZoomIn aria-hidden="true" className="size-4" />
        <span className="max-sm:hidden">{zoomLabel(zoom)}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-40 flex w-[min(300px,calc(100vw-32px))] animate-pop-in flex-col gap-2.5 glass-popover p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">Dashboard zoom</span>
            <span className="text-xs text-muted">Saved on this device for you. Keys: {keys}= larger, {keys}- smaller, {keys}0 reset.</span>
          </div>
          <ZoomStepper />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
