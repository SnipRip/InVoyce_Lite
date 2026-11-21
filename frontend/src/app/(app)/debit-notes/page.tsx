import type { Metadata } from "next";
import { NotesListScreen } from "@/features/notes/note-screens";

export const metadata: Metadata = { title: "Debit notes" };

export default function DebitnotesPage() {
  return <NotesListScreen kind="debit" />;
}
