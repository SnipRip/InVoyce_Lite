"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import useSWR from "swr";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { ApiError, apiGet } from "@/lib/api-client";
import { useToday } from "@/lib/use-today";
import type { OpenDocumentView, SettlementDirectionView } from "@/types/settlement";
import { AllocationTable } from "./allocation-table";
import { applyAdvanceSchema, type ApplyAdvanceValues } from "./settlement-schema";
import { applyOldestFirst, documentsPath } from "./settlements-api";

interface ApplyCreditFormProps {
  /** RECEIPT: the credit settles what the customer owes; PAYMENT: what we owe the vendor. */
  direction: SettlementDirectionView;
  partyId: string;
  partyName: string;
  creditLeft: number;
  /** The document holding the credit, so it is never offered to itself. */
  sourceId?: string;
  apply: (allocations: { kind: string; documentId: string; amount: number }[]) => Promise<unknown>;
  onChanged: () => Promise<void>;
  /** Where the credit can be paid back instead (a note's refund). */
  refund?: { href: string; label: string };
}

const failure = (error: unknown) => (error instanceof ApiError ? error.message : "Could not save. Check the connection and try again.");

// A party's credit (left on a credit or debit note, or a settling journal
// line) applied to their open documents, oldest first or by hand.
export function ApplyCreditForm({ direction, partyId, partyName, creditLeft, sourceId, apply, onChanged, refund }: ApplyCreditFormProps) {
  const today = useToday();
  const [problem, setProblem] = useState<string | null>(null);
  const { data: documents, mutate: reloadDocuments } = useSWR<OpenDocumentView[]>(documentsPath(direction, partyId), apiGet);
  const open = (documents ?? []).filter((document) => document.balance > 0 && document.id !== sourceId);
  const rowsFrom = (plan?: Map<string, number>) =>
    open.map((document) => ({ kind: document.kind, documentId: document.id, balance: document.balance, amount: plan?.has(document.id) ? String(plan.get(document.id)) : "" }));
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyAdvanceValues>({ resolver: zodResolver(applyAdvanceSchema(creditLeft)), values: { allocations: rowsFrom(), free: creditLeft } });
  const rows = useFieldArray({ control, name: "allocations" });

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      await apply(values.allocations.filter((row) => Number(row.amount) > 0).map((row) => ({ kind: row.kind, documentId: row.documentId, amount: Number(row.amount) })));
      await Promise.all([onChanged(), reloadDocuments()]);
    } catch (error) {
      setProblem(failure(error));
    }
  });

  // Rows follow the form, which catches up with the documents once they load; the table waits until they match.
  const ready = rows.fields.length === open.length && rows.fields.every((field) => open.some((document) => document.id === field.documentId));
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Apply the credit</span>
        <Button variant="outline" className="ml-auto" disabled={open.length === 0} onClick={() => rows.replace(rowsFrom(applyOldestFirst(creditLeft, open)))}>
          Apply oldest first
        </Button>
        {refund && (
          <Link href={refund.href} className={buttonClasses("neutral")}>
            {refund.label}
          </Link>
        )}
      </div>
      {!documents || !ready ? (
        <p className="text-sm font-medium text-muted">Loading what is open…</p>
      ) : open.length === 0 ? (
        <p className="text-sm font-medium text-muted">Nothing open with {partyName}. It stays as their credit until something is.</p>
      ) : (
        <AllocationTable
          documents={rows.fields.map((field) => open.find((document) => document.id === field.documentId)!)}
          rowIds={rows.fields.map((field) => field.id)}
          register={register}
          errors={errors}
          today={today}
          documentWord={direction === "RECEIPT" ? "Invoice / charge" : "Bill / charge"}
        />
      )}
      {errors.free?.message && <FormMessage tone="error">{errors.free.message}</FormMessage>}
      {problem && <FormMessage tone="error">{problem}</FormMessage>}
      {open.length > 0 && (
        <Button type="submit" className="self-start" disabled={isSubmitting}>
          {isSubmitting ? "Applying…" : "Apply"}
        </Button>
      )}
    </form>
  );
}
