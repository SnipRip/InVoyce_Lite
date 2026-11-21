"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title saying what the dialog is for. */
  description?: string;
  children: ReactNode;
  /** Buttons, right-aligned along the bottom. */
  footer?: ReactNode;
  /** "wide" for a dialog holding a table rather than a short form. */
  size?: "default" | "medium" | "wide";
  /** Shown under the title in the fixed top part, e.g. a dialog's steps. */
  toolbar?: ReactNode;
}

// A dialog floating over the page (Radix Dialog: focus is trapped inside,
// Escape and a click outside close it). The sheet is the dense popover glass
// and the page behind is dimmed, not blurred a second time, so text in the
// dialog stays sharp and opening it costs one blur layer, not two.
export function GlassModal({ open, onOpenChange, title, description, children, footer, size = "default", toolbar }: GlassModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 animate-fade-in bg-ink/35" />
        <div className="pointer-events-none fixed inset-0 z-30 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <Dialog.Content
            // Closing a toast is not a click outside the dialog.
            onInteractOutside={(event) => {
              if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]")) event.preventDefault();
            }}
            className={clsx(
              // Title (and toolbar) stay put at the top, the footer at the bottom; only the body scrolls.
              "glass-popover pointer-events-auto flex max-h-full w-full animate-pop-in flex-col overflow-hidden [border-radius:12px]",
              size === "wide" ? "max-w-[860px]" : size === "medium" ? "max-w-[640px]" : "max-w-[480px]",
            )}
          >
            <div className="flex shrink-0 flex-col gap-3 px-[18px] pt-4 pb-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Dialog.Title className="text-[15px] leading-tight font-semibold">{title}</Dialog.Title>
                  {description && <Dialog.Description className="text-xs text-muted">{description}</Dialog.Description>}
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="-mt-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-(--radius-control) text-muted hover:bg-ink/5 hover:text-ink"
                >
                  <X aria-hidden="true" className="size-4" />
                </Dialog.Close>
              </div>
              {toolbar}
            </div>
            <div className={"modal-body flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-0.5 pb-4"}>{children}</div>
            {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-ink/[0.025] px-[18px] py-3">{footer}</div>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
