import type { Metadata } from "next";
import { JournalsListScreen } from "@/features/journals/journal-screens";

export const metadata: Metadata = { title: "Journal entries" };

export default function JournalsPage() {
  return <JournalsListScreen />;
}
