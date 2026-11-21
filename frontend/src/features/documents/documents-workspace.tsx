"use client";

import { StatTile } from "@/components/ui/stat-tile";
import { formatQuantity } from "@/lib/format";
import type { DocumentRegisterView } from "@/types/document-register";
import { MissingPapersCard } from "./missing-papers-card";
import { RegisterTableCard } from "./register-table-card";

// The dispatch documents register: every document number on record, and the
// required papers still to attach.
export function DocumentsWorkspace({ register }: { register: DocumentRegisterView }) {
  const { entries, missing } = register;
  const count = (kind: string) => entries.filter((entry) => entry.kind === kind).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Documents on record" value={formatQuantity(entries.length)} />
        <StatTile label="Required, not attached" value={formatQuantity(missing.length)} tone={missing.length ? "warning" : undefined} />
        <StatTile label="E-way bills" value={formatQuantity(count("EWAY_BILL") + count("PURCHASE_EWAY_BILL"))} />
        <StatTile label="IRNs" value={formatQuantity(count("E_INVOICE"))} />
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <RegisterTableCard entries={entries} />
        </div>
        <MissingPapersCard missing={missing} />
      </div>
    </div>
  );
}
