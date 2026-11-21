import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";

interface GstApplicableToggleProps {
  value: boolean;
  onChange: (applicable: boolean) => void;
  /** Why it cannot be changed (we charge no GST). */
  lockedReason?: string;
}

// "GST applicable / Not applicable" on a quotation, invoice or vendor bill.
// Not applicable saves every line at 0% (a bill of supply on a sale; no GST
// to pay or claim on a purchase).
export function GstApplicableToggle({ value, onChange, lockedReason }: GstApplicableToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">GST</span>
      <FilterGroup label="GST on this document">
        <FilterChip selected={value} disabled={Boolean(lockedReason)} onClick={() => onChange(true)}>
          GST applicable
        </FilterChip>
        <FilterChip selected={!value} disabled={Boolean(lockedReason)} onClick={() => onChange(false)}>
          Not applicable
        </FilterChip>
      </FilterGroup>
      {lockedReason && <p className="text-[11.5px] font-medium text-muted">{lockedReason}</p>}
    </div>
  );
}
