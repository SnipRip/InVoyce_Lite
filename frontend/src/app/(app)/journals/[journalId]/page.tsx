import type { Metadata } from "next";
import { Suspense } from "react";
import { JournalScreen } from "@/features/journals/journal-screens";

export const metadata: Metadata = { title: "Journal entry" };

type JournalParams = PageProps<"/journals/[journalId]">["params"];

// `params` is request data, so it is read inside a Suspense boundary.
export default function JournalPage({ params }: { params: JournalParams }) {
  return (
    <Suspense>
      <Journal params={params} />
    </Suspense>
  );
}

async function Journal({ params }: { params: JournalParams }) {
  return <JournalScreen journalId={(await params).journalId} />;
}
