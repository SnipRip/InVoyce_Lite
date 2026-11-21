import type { Metadata } from "next";
import { Suspense } from "react";
import { NoteScreen } from "@/features/notes/note-screens";

export const metadata: Metadata = { title: "Credit note" };

type NoteParams = PageProps<"/credit-notes/[noteId]">["params"];

// `params` is request data, so it is read inside a Suspense boundary.
export default function CreditnotePage({ params }: { params: NoteParams }) {
  return (
    <Suspense>
      <Note params={params} />
    </Suspense>
  );
}

async function Note({ params }: { params: NoteParams }) {
  return <NoteScreen kind="credit" noteId={(await params).noteId} />;
}
