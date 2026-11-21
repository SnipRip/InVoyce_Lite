import type { InputHTMLAttributes, Ref } from "react";
import { TextField } from "@/components/ui/text-field";
import type { LineGstContext } from "./line-gst-rate";

interface LineGstCellProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  /** The item's HSN / SAC rate, shown when nothing is typed and kept when enforced. */
  master?: number;
  context: LineGstContext;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

// The GST % column of a document line. Typed freely unless the company keeps
// lines at their HSN rate (then read-only, and Enter skips it); shows 0 when
// the document has no GST. Spread `register("lines.N.gstRatePct")` onto it.
export function LineGstCell({ master, context, error, ...registered }: LineGstCellProps) {
  if (!context.applicable || context.enforce) {
    // A separate read-only field: the registered one keeps what was typed for when GST applies again.
    return (
      <TextField
        label="GST %"
        hideLabel
        readOnly
        tabIndex={-1}
        value={!context.applicable ? "0" : master === undefined ? "" : String(master)}
        placeholder="No HSN rate"
        title={context.applicable ? "From the item's HSN / SAC (company setting)" : "GST not applicable"}
        className="text-right text-muted"
      />
    );
  }
  return <TextField label="GST %" hideLabel inputMode="decimal" placeholder={master === undefined ? "Rate" : String(master)} error={error} className="text-right" {...registered} />;
}
