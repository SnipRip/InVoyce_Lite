import type { Metadata } from "next";
import { Suspense } from "react";
import { NoteScreen } from "@/features/notes/note-screens";

export const metadata: Metadata = { title: "Debit note" };

type NoteParams = PageProps<"/debit-notes/[noteId]">["params"];

// `params` is request data, so it is read inside a Suspense boundary.
export default function DebitnotePage({ params }: { params: NoteParams }) {
  return (
    <Suspense>
      <Note params={params} />
    </Suspense>
  );
}

async function Note({ params }: { params: NoteParams }) {
  return <NoteScreen kind="debit" noteId={(await params).noteId} />;
}
