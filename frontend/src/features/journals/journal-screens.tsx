"use client";

import useSWR from "swr";
import { LoadNotice } from "@/components/ui/load-notice";
import { apiGet } from "@/lib/api-client";
import type { JournalView } from "@/types/journal";
import { JournalDetail } from "./journal-detail";
import { JournalForm } from "./journal-form";
import { JOURNALS_PATH, useJournalLedgers } from "./journals-api";
import { JournalsWorkspace } from "./journals-workspace";

// The journal pages' client screens, from the backend.
const useJournals = () => useSWR<JournalView[]>(JOURNALS_PATH, apiGet);

export function JournalsListScreen() {
  const { data, error } = useJournals();
  if (!data) return <LoadNotice error={error} what="journals" />;
  return <JournalsWorkspace journals={data} />;
}

export function NewJournalScreen() {
  const { mutate } = useJournals();
  const { options, error } = useJournalLedgers();
  if (!options) return <LoadNotice error={error} what="the ledgers" />;
  return (
    <JournalForm
      ledgers={options}
      onSaved={async () => {
        await mutate();
      }}
    />
  );
}

export function JournalScreen({ journalId }: { journalId: string }) {
  const { data, error, mutate } = useJournals();
  if (!data) return <LoadNotice error={error} what="the journal" />;
  const journal = data.find((candidate) => candidate.id === journalId);
  if (!journal) return <LoadNotice error={new Error("This journal does not exist.")} what="the journal" />;
  return (
    <JournalDetail
      journal={journal}
      onChanged={async () => {
        await mutate();
      }}
    />
  );
}
