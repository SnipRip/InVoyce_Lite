"use client";

import { useState } from "react";
import { mutate } from "swr";
import { GlassModal } from "@/components/ui/glass-modal";
import { ApiError } from "@/lib/api-client";
import { usePickWhenListed } from "@/lib/use-pick-when-listed";
import { fromFormValues, type FieldSpec } from "./record-fields";
import { RecordForm } from "./record-form";
import type { MasterRecord, RecordPersistence } from "./record-master";

interface QuickAddRecordOptions<T extends MasterRecord> {
  /** "New godown". */
  title: string;
  fields: FieldSpec[];
  blank: Record<string, unknown>;
  /** The master's own save calls, so the record is checked and saved the same way. */
  persistence: RecordPersistence<T>;
  /** SWR keys starting with this reload once it is saved: "/godowns". */
  path: string;
  /** The picker's own list; the new record is picked once it is in it. */
  listedIds: readonly string[];
  onPick: (id: string) => void;
}

// The "+" beside a small master's picker (godown, expense head…): the
// master's own form in a dialog, its fields on one screen (client, 12 Nov
// 2026). The record is saved through the master's calls and picked here.
export function useQuickAddRecord<T extends MasterRecord>({ title, fields, blank, persistence, path, listedIds, onPick }: QuickAddRecordOptions<T>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickLater = usePickWhenListed<null>(listedIds, (id) => onPick(id));
  return {
    open: () => {
      setError(null);
      setOpen(true);
    },
    dialog: (
      <GlassModal open={open} onOpenChange={setOpen} title={title} description="Saved to its master and picked here." size="medium">
        {open && (
          <div onKeyDown={(event) => event.stopPropagation()}>
            <RecordForm
              fields={fields}
              initial={blank}
              submitLabel="Save"
              error={error}
              onCancel={() => setOpen(false)}
              onSubmit={async (values) => {
                setError(null);
                try {
                  const saved = await persistence.create(fromFormValues(fields, values));
                  await mutate((key) => typeof key === "string" && key.startsWith(path));
                  pickLater(saved.id, null);
                  setOpen(false);
                } catch (caught) {
                  setError(caught instanceof ApiError ? caught.message : "Could not save. Check the connection and try again.");
                }
              }}
            />
          </div>
        )}
      </GlassModal>
    ),
  };
}
