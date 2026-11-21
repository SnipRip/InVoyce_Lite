import type { Metadata } from "next";
import { Suspense } from "react";
import { NewNoteScreen } from "@/features/notes/note-screens";

export const metadata: Metadata = { title: "New credit note" };

// Suspense: the form reads ?invoice= from the address.
export default function NewCreditnotePage() {
  return (
    <Suspense>
      <NewNoteScreen kind="credit" />
    </Suspense>
  );
}
