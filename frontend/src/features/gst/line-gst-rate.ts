// The GST % a document line works at, as the backend saves it
// (src/common/gst/line-gst-rate.ts). No React.
//
// The item's HSN / SAC rate fills the line. When the company enforces it
// (company profile), that rate stands; otherwise the rate typed on the line
// does. A document marked "GST not applicable" has every line at 0%.
import type { TaxDecision } from "./gst-rules";

export interface LineGstContext {
  /** Company setting: lines keep their HSN's rate. */
  enforce: boolean;
  /** False: the document carries no GST. */
  applicable: boolean;
}

/** The rate the line is worked at; `typed` is the line's text ("" = the HSN rate). */
export function effectiveGstRate(master: number | undefined, typed: string, { enforce, applicable }: LineGstContext): number {
  if (!applicable) return 0;
  if (enforce || typed.trim() === "") return master ?? 0;
  return Number(typed) || 0;
}

/** What the line sends: nothing when the HSN rate applies (the server fills it), else the typed rate. */
export function gstRateToSend(typed: string, { enforce, applicable }: LineGstContext): number | null {
  if (!applicable || enforce || typed.trim() === "") return null;
  return Number(typed);
}

/** A rate a line may carry: a percentage up to 2 decimals, 0 to 100. */
export const isGstRateText = (text: string) => text.trim() === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(text.trim()) && Number(text) <= 100);

/** The decision shown for a document entered as "GST not applicable". */
export function withoutGst(decision: TaxDecision, document: "sale" | "bill"): TaxDecision {
  return {
    ...decision,
    regime: "no-gst",
    title: "GST not applicable",
    detail: document === "sale" ? "Entered without GST: a bill of supply, every line at 0%." : "The vendor's bill carries no GST: nothing to pay as GST or claim back.",
    itc: document === "bill" ? false : decision.itc,
    blocked: undefined,
  };
}
