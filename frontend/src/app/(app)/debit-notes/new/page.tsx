import type { Metadata } from "next";
import { Suspense } from "react";
import { NewNoteScreen } from "@/features/notes/note-screens";

export const metadata: Metadata = { title: "New debit note" };

// Suspense: the form reads ?bill= from the address.
export default function NewDebitnotePage() {
  return (
    <Suspense>
      <NewNoteScreen kind="debit" />
    </Suspense>
  );
}
