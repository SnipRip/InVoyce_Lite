"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useId, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { INVOICES_PATH, KIND_VIEW_OF } from "./invoices-api";
import type { DispatchDocumentKind, DocumentFile } from "./types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

const filesPath = (invoiceId: string, kind: DispatchDocumentKind) => `${INVOICES_PATH}/${invoiceId}/documents/${KIND_VIEW_OF[kind]}/files`;
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// The scans and PDFs kept with one dispatch document (client, 12 Nov 2026):
// open one in a new tab, add up to five (2 MB each), remove one. The server
// reads each file's type from its bytes; the checks here only save a trip.
export function DocumentFiles({ invoiceId, kind, files, canEdit, onChanged }: { invoiceId: string; kind: DispatchDocumentKind; files: DocumentFile[]; canEdit: boolean; onChanged: () => Promise<void> }) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const upload = async (picked: File[]) => {
    setProblem(null);
    if (files.length + picked.length > MAX_FILES) return setProblem(`Up to ${MAX_FILES} files per document`);
    const large = picked.find((file) => file.size > MAX_BYTES);
    if (large) return setProblem(`${large.name} is over 2 MB`);
    setBusy(true);
    try {
      for (const file of picked) {
        const body = new FormData();
        body.append("file", file);
        await apiRequest(filesPath(invoiceId, kind), { method: "POST", body });
      }
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : "Could not upload. Check the connection and try again.");
    } finally {
      setBusy(false);
      await onChanged();
    }
  };

  const remove = async (file: DocumentFile) => {
    setProblem(null);
    setBusy(true);
    try {
      await apiRequest(`${filesPath(invoiceId, kind)}/${file.id}`, { method: "DELETE" });
      await onChanged();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : "Could not remove the file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 flex flex-col gap-1">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Files">
          {files.map((file) => (
            <li key={file.id} className="glass-control flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-semibold">
              <FileText aria-hidden="true" className="size-3.5 text-brand" />
              <a href={`/api${filesPath(invoiceId, kind)}/${file.id}`} target="_blank" rel="noopener" className="max-w-[180px] truncate hover:text-brand hover:underline">
                {file.name}
              </a>
              <span className="text-muted">{size(file.size)}</span>
              {canEdit && (
                <button type="button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => void remove(file)} className="rounded p-0.5 text-muted hover:bg-ink/5 hover:text-danger-strong">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && files.length < MAX_FILES && (
        <label htmlFor={inputId} className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs font-semibold text-brand hover:underline">
          <Paperclip aria-hidden="true" className="size-3.5" />
          {busy ? "Uploading…" : files.length ? "Add another file" : "Attach the scan or PDF"}
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (picked.length) void upload(picked);
            }}
          />
        </label>
      )}
      {problem && <p className="text-xs font-semibold text-danger-strong">{problem}</p>}
    </div>
  );
}
