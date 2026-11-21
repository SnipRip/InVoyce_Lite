"use client";

import { useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { LoadNotice } from "@/components/ui/load-notice";
import { useCompanyProfile } from "@/features/company/use-company-profile";
import { INVOICES_PATH } from "@/features/invoices/invoices-api";
import { PARTIES_PATH, toParty } from "@/features/parties/parties-api";
import { issuerOf } from "@/features/quotations/quotations-api";
import { GODOWNS_PATH } from "@/features/masters/masters-api";
import { PURCHASE_BILLS_PATH } from "@/features/purchases/purchases-api";
import { apiGet } from "@/lib/api-client";
import type { InvoiceView } from "@/types/invoice";
import type { GodownView } from "@/types/item-master";
import type { CreditNoteView, DebitNoteView } from "@/types/note";
import type { PartyView } from "@/types/party";
import type { PurchaseBillView } from "@/types/purchase";
import { NoteDetail } from "./note-detail";
import { NoteForm } from "./note-form";
import { CREDIT_NOTES_PATH, creditDocuments, DEBIT_NOTES_PATH, debitDocuments, type NoteKind } from "./notes-api";
import { NotesWorkspace } from "./notes-workspace";

// The credit and debit note pages' client screens, from the backend.
const pathOf = (kind: NoteKind) => (kind === "credit" ? CREDIT_NOTES_PATH : DEBIT_NOTES_PATH);
const useNotes = (kind: NoteKind) => useSWR<(CreditNoteView | DebitNoteView)[]>(pathOf(kind), apiGet);

export function NotesListScreen({ kind }: { kind: NoteKind }) {
  const { data, error } = useNotes(kind);
  if (!data) return <LoadNotice error={error} what={kind === "credit" ? "credit notes" : "debit notes"} />;
  return <NotesWorkspace kind={kind} notes={data} />;
}

export function NewNoteScreen({ kind }: { kind: NoteKind }) {
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const notes = useNotes(kind);
  const invoices = useSWR<InvoiceView[]>(kind === "credit" ? INVOICES_PATH : null, apiGet);
  const bills = useSWR<PurchaseBillView[]>(kind === "debit" ? PURCHASE_BILLS_PATH : null, apiGet);
  const godowns = useSWR<GodownView[]>(kind === "credit" ? GODOWNS_PATH : null, apiGet);
  const source = kind === "credit" ? invoices : bills;
  const error = notes.error ?? source.error ?? godowns.error;
  if (!notes.data || !source.data || (kind === "credit" && !godowns.data)) return <LoadNotice error={error} what="the note form" />;
  const documents =
    kind === "credit" ? creditDocuments(invoices.data!, notes.data as CreditNoteView[]) : debitDocuments(bills.data!, notes.data as DebitNoteView[]);
  return (
    <NoteForm
      kind={kind}
      documents={documents}
      godowns={(godowns.data ?? []).filter((godown) => !godown.isArchived)}
      initialDocumentId={params.get(kind === "credit" ? "invoice" : "bill") ?? undefined}
      onSaved={async () => {
        // The document's balance, outstanding and stock all move with a note.
        await Promise.all([notes.mutate(), mutate((key) => typeof key === "string" && /^\/(invoices|purchase-bills|settlements|items)/.test(key))]);
      }}
    />
  );
}

export function NoteScreen({ kind, noteId }: { kind: NoteKind; noteId: string }) {
  const { data, error, mutate } = useNotes(kind);
  const { profile, error: profileError } = useCompanyProfile();
  const note = data?.find((candidate) => candidate.id === noteId);
  // The party's address and GSTIN for the printed note; it prints the name alone until they load.
  const party = useSWR<PartyView>(note ? `${PARTIES_PATH}/${note.partyId}` : null, apiGet);
  if (!data || !profile) return <LoadNotice error={error ?? profileError} what="the note" />;
  if (!note) return <LoadNotice error={new Error("This note does not exist.")} what="the note" />;
  return (
    <NoteDetail
      kind={kind}
      note={note}
      party={party.data ? toParty(party.data) : undefined}
      issuer={issuerOf(profile)}
      onChanged={async () => {
        await mutate();
      }}
    />
  );
}
