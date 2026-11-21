import Link from "next/link";
import { StatusChip } from "@/components/ui/status-chip";

// The number a save will take, or (no format in force for the date) a
// warning with the way to fix it, shown before the save is refused.
export function NextNumberChip({ next }: { next?: { number: string | null; method: string } }) {
  if (!next) return <StatusChip tone="neutral">Numbered on save</StatusChip>;
  if (next.number) return <StatusChip tone="neutral">Will be {next.number}</StatusChip>;
  if (next.method !== "AUTOMATIC") return <StatusChip tone="neutral">Type the number</StatusChip>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusChip tone="danger">No number format yet</StatusChip>
      <Link href="/masters/number-series" className="text-xs font-semibold text-brand hover:underline">
        Add one under Number series
      </Link>
    </span>
  );
}
