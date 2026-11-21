// Keyboard-first field order for the stepped voucher forms (VoucherSteps):
// Enter moves to the next field of the open step, Shift+Enter back. Only
// fields that take typing or a pick are visited (inputs, dropdowns, pickers);
// buttons keep Enter for themselves. No React.

const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])',
  "textarea",
  'button[role="combobox"]',
].join(",");

/** Fired by a field (e.g. ComboField after a pick) that wants the voucher to go on past the step's last field. */
export const VOUCHER_END_EVENT = "voucher:end";

const visitable = (element: HTMLElement) => {
  if (element.closest("[data-voucher-skip]")) return false;
  if ((element as HTMLInputElement).disabled || (element as HTMLInputElement).readOnly) return false;
  return element.getClientRects().length > 0;
};

/** The fields of a step in page order. */
export function voucherFields(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)].filter(visitable);
}

/** Focuses a field and selects what is typed in it, so typing replaces it. */
export function focusField(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  element.focus();
  if (element instanceof HTMLInputElement && typeof element.select === "function" && element.type !== "date") element.select();
  return true;
}

/** Moves from `from` to the next (or previous) field of its step; false when there is none. */
export function moveFocus(from: HTMLElement, step: 1 | -1): boolean {
  const root = from.closest("[data-voucher-step]");
  if (!root) return false;
  const fields = voucherFields(root);
  const index = fields.indexOf(from);
  return focusField(fields[index + step]);
}

/** Next field, or tell the voucher this step is done. Nothing when the field has left the screen meanwhile (another step opened). */
export function advanceFrom(from: HTMLElement) {
  if (!from.isConnected || from.getClientRects().length === 0 || document.activeElement !== from) return;
  if (!moveFocus(from, 1)) from.dispatchEvent(new CustomEvent(VOUCHER_END_EVENT, { bubbles: true }));
}

/** The first field of the open step. */
export const focusFirstField = (root: ParentNode | null) => Boolean(root) && focusField(voucherFields(root!)[0]);
