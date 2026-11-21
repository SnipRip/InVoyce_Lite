"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { LoadNotice } from "@/components/ui/load-notice";
import { StatusChip } from "@/components/ui/status-chip";
import { apiGet } from "@/lib/api-client";
import { formatQuantity } from "@/lib/format";
import type { GodownView } from "@/types/item-master";
import { godownPersistence, GODOWNS_PATH, toGodown, withArchived } from "./masters-api";
import type { FieldSpec } from "./record-fields";
import { RecordMaster } from "./record-master";
import type { Godown } from "./types";

const KINDS = [
  { value: "store", label: "Store" },
  { value: "yard", label: "Open yard" },
  { value: "site", label: "Customer site" },
];

/** The godown form, shared by the master and the "+" beside godown pickers. */
export const GODOWN_BLANK: Partial<Godown> = { kind: "store", isDefault: false };
export const GODOWN_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", kind: "text", required: true, placeholder: "M.G. Road store" },
  { key: "kind", label: "Kind", kind: "select", options: KINDS, required: true },
  { key: "address", label: "Address", kind: "text", required: true, wide: true },
  { key: "inCharge", label: "In charge", kind: "text" },
  { key: "phone", label: "Phone", kind: "text", pattern: /^\+[1-9]\d{7,14}$/, message: "With the country code, for example +919635312988" },
  { key: "isDefault", label: "Default for purchases, sales and opening stock", kind: "toggle", onLabel: "Default", offLabel: "Not default", hint: "Only one godown is the default. Choosing this one replaces the current default.", wide: true },
];

export function GodownsMaster() {
  const { data, error, mutate } = useSWR<GodownView[]>(withArchived(GODOWNS_PATH), apiGet);
  const godowns = useMemo(() => data?.map(toGodown), [data]);
  if (!godowns) return <LoadNotice error={error} what="godowns" />;

  return (
    <RecordMaster
      noun={["godown", "godowns"]}
      initialRecords={godowns}
      persist={godownPersistence(() => void mutate())}
      nameKey="name"
      blank={GODOWN_BLANK}
      fields={GODOWN_FIELDS}
      columns={[
        { label: "Godown", render: (godown) => godown.name },
        { label: "Kind", render: (godown) => KINDS.find((kind) => kind.value === godown.kind)?.label },
        { label: "Address", render: (godown) => <span className="text-ink-soft">{godown.address}</span> },
        { label: "In charge", render: (godown) => godown.inCharge ?? "–" },
        { label: "Default", render: (godown) => (godown.isDefault ? <StatusChip tone="brand">Default</StatusChip> : null) },
      ]}
      searchText={(godown) => `${godown.name} ${godown.address} ${godown.inCharge ?? ""}`}
      stats={(records) => [
        { label: "Godowns", value: formatQuantity(records.length) },
        { label: "Stores", value: formatQuantity(records.filter((godown) => godown.kind === "store").length) },
        { label: "Yards", value: formatQuantity(records.filter((godown) => godown.kind === "yard").length) },
        { label: "Default", value: records.find((godown) => godown.isDefault)?.name ?? "None" },
      ]}
      importMaster="godowns"
      footnote="Stock is held per godown once stock moves are recorded; until then items show one total."
    />
  );
}
