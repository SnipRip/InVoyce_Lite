import type { Metadata } from "next";
import { NotesListScreen } from "@/features/notes/note-screens";

export const metadata: Metadata = { title: "Credit notes" };

export default function CreditnotesPage() {
  return <NotesListScreen kind="credit" />;
}
