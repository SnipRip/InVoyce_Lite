import type { Metadata } from "next";
import { NewJournalScreen } from "@/features/journals/journal-screens";

export const metadata: Metadata = { title: "New journal entry" };

export default function NewJournalPage() {
  return <NewJournalScreen />;
}
