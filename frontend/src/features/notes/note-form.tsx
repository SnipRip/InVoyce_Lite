"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Button, buttonClasses } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { FormMessage } from "@/components/ui/form-message";
import { CardTitle } from "@/components/ui/glass-card";
import { VoucherSteps } from "@/components/ui/voucher-steps";
import { GlassTable } from "@/components/ui/glass-table";
import { SelectField } from "@/components/ui/select-field";
import { NextNumberChip } from "@/features/number-series/next-number-chip";
import { TextField } from "@/components/ui/text-field";
import { ApiError, apiGet } from "@/lib/api-client";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import { useToday } from "@/lib/use-today";
import type { NoteReasonView } from "@/types/note";
import { previewLine, previewTotals, quantityLeft, taxableLeft, type NoteLinePreview } from "./note-rules";
import { createCreditNote, createDebitNote, NOTE_TEXT, notePreviewPath, REASONS, type NoteDocument, type NoteKind } from "./notes-api";

interface NoteFormProps {
  kind: NoteKind;
  documents: NoteDocument[];
  /** Credit notes: where returned goods go back in. */
  godowns?: { id: string; name: string }[];
  initialDocumentId?: string;
  onSaved: () => Promise<void>;
}

// A credit note against an invoice, or a debit note against a goods bill
// (client, 12 Nov 2026). Pick the document, say why, then per line the
// quantity that came back (goods returned) or the amount to take off. The
// figures follow the document's own rates and GST; the server checks again.
export function NoteForm({ kind, documents, godowns = [], initialDocumentId, onSaved }: NoteFormProps) {
  const text = NOTE_TEXT[kind];
  const today = useToday();
  const router = useRouter();
  const [documentId, setDocumentId] = useState(documents.some((document) => document.id === initialDocumentId) ? initialDocumentId! : "");
  const [reason, setReason] = useState<NoteReasonView>("GOODS_RETURNED");
  /** Value-only notes may leave GST alone (a discount not agreed before the sale, CGST s.15(3)(b)). */
  const [withGst, setWithGst] = useState(true);
  const [picked, setPicked] = useState("");
  const [number, setNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? "");
  const [inputs, setInputs] = useState<Record<string, { quantity: string; taxable: string }>>({});
  const [result, setResult] = useState<{ text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const date = picked || today || "";
  const { data: next } = useSWR<{ number: string | null; method: string }>(date ? notePreviewPath(kind, date) : null, apiGet);
  const numberTyped = next !== undefined && next.method !== "AUTOMATIC";

  const document = documents.find((candidate) => candidate.id === documentId);
  const goods = reason === "GOODS_RETURNED";
  const gstAdjusted = goods || withGst;
  const previews = (document?.lines ?? []).map((line) => ({ line, preview: previewLine(line, inputs[line.id] ?? { quantity: "", taxable: "" }, goods, gstAdjusted ? document!.split : "NONE") }));
  const valid = previews.filter((entry): entry is { line: (typeof entry)["line"]; preview: NoteLinePreview } => typeof entry.preview === "object" && entry.preview !== null);
  const problems = previews.filter((entry) => typeof entry.preview === "string");
  const totals = previewTotals(valid.map((entry) => entry.preview));
  /** More than the document still owes: the rest becomes the party's credit. */
  const overDue = document && totals.total > document.due + 0.005;

  const setInput = (lineId: string, field: "quantity" | "taxable", value: string) =>
    setInputs((current) => ({ ...current, [lineId]: { ...(current[lineId] ?? { quantity: "", taxable: "" }), [field]: value } }));

  const save = async () => {
    setResult(null);
    if (!document) {
      setStep(0);
      return setResult({ text: `Pick the ${text.against}` });
    }
    setStep(1);
    if (!valid.length) return setResult({ text: goods ? "Enter the quantity that came back on at least one line" : "Enter an amount on at least one line" });
    if (problems.length) return setResult({ text: String(problems[0].preview) });
    if (kind === "credit" && goods && !godownId) return setResult({ text: "Pick the godown the goods go back into" });
    setBusy(true);
    try {
      const body = {
        date,
        number: number.trim() || null,
        reason,
        gstAdjusted,
        notes: notes.trim() || null,
        lines: valid.map(({ line, preview }) => (goods ? { lineId: line.id, quantity: preview.quantity } : { lineId: line.id, taxable: preview.taxable })),
      };
      const saved = kind === "credit" ? await createCreditNote(document.id, goods ? godownId : null, body) : await createDebitNote(document.id, body);
      await onSaved();
      router.push(`${text.path}/${saved.id}`);
    } catch (error) {
      setResult({ text: error instanceof ApiError ? error.message : "Could not save. Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  // Two steps that each fit the screen, worked like a voucher: the document
  // and reason, then its lines (client, 13 Nov 2026).
  return (
    <form
      noValidate
      className="max-w-[1180px]"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <VoucherSteps
        heading={
          <>
            <CardTitle>New {text.title.toLowerCase()}</CardTitle>
            <NextNumberChip next={next} />
          </>
        }
        step={step}
        onStepChange={setStep}
        onAccept={() => void save()}
        steps={[
          {
            id: "document",
            title: kind === "credit" ? "Invoice & reason" : "Bill & reason",
            summary: document?.number,
            content: (
              <>
                <div className="grid items-start gap-3.5 @xl:grid-cols-[minmax(0,2fr)_170px_170px]">
                  <ComboField
                    label={text.document}
                    options={documents.map((candidate) => ({
                      value: candidate.id,
                      label: `${candidate.number} · ${candidate.partyName}`,
                      detail: `${formatDate(candidate.date)} · ${candidate.due > 0 ? `${formatRate(candidate.due)} due` : "settled"}`,
                    }))}
                    value={documentId}
                    onChange={(id) => {
                      setDocumentId(id);
                      setInputs({});
                    }}
                    placeholder={`Type the ${text.against} number or ${text.party.toLowerCase()}`}
                    hint={documents.length ? undefined : `No ${text.against} has anything left to take back.`}
                  />
                  <TextField label="Date" type="date" value={date} min={document?.date} max={today ?? undefined} onChange={(event) => setPicked(event.target.value)} />
                  <TextField
                    label="Number"
                    disabled={!numberTyped}
                    value={number}
                    placeholder={next?.number ?? ""}
                    hint={numberTyped ? "Type it, or leave blank for the next" : "Given on save"}
                    onChange={(event) => setNumber(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">Why</span>
                    <FilterGroup label="Why">
                      {REASONS.map((option) => (
                        <FilterChip
                          key={option.value}
                          selected={reason === option.value}
                          onClick={() => {
                            setReason(option.value);
                            setInputs({});
                          }}
                        >
                          {option.label}
                        </FilterChip>
                      ))}
                    </FilterGroup>
                  </div>
                  {!goods && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted">GST on this note</span>
                      <FilterGroup label="GST on this note">
                        <FilterChip selected={withGst} onClick={() => setWithGst(true)}>
                          Reduce GST
                        </FilterChip>
                        <FilterChip selected={!withGst} onClick={() => setWithGst(false)}>
                          Without GST
                        </FilterChip>
                      </FilterGroup>
                    </div>
                  )}
                  {kind === "credit" && goods && (
                    <SelectField
                      label="Goods go back into"
                      className="min-w-[200px]"
                      options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))}
                      value={godownId || undefined}
                      onValueChange={setGodownId}
                    />
                  )}
                </div>
                <p className="text-xs font-medium text-muted">
                  {goods
                    ? `${text.goods}: enter what came back on each line. It is valued at the line's own price after discount, with its GST${kind === "credit" ? ", and the stock comes back at the cost it left at" : ", and leaves this bill's own stock"}.`
                    : gstAdjusted
                      ? "Enter the amount to take off each line before GST; its GST follows the line's rate. Use this when the discount or price was agreed before the sale."
                      : `Without GST: a discount not agreed before the sale does not lower the taxable value (CGST s.15(3)(b)). The note carries no GST, stays out of the GST returns and is booked as ${kind === "credit" ? "Discount Allowed" : "Discount Received"}.`}
                </p>
                <TextField label="Notes" placeholder="Shown on the note and in the books" value={notes} onChange={(event) => setNotes(event.target.value)} />
                {result && !document && (
                  <FormMessage tone="error" result={result}>
                    {result.text}
                  </FormMessage>
                )}
              </>
            ),
          },
          {
            id: "lines",
            title: "Lines",
            summary: valid.length ? `${valid.length} ${valid.length === 1 ? "line" : "lines"}` : undefined,
            invalid: problems.length > 0,
            content: document ? (
              <>
                <p className="text-sm font-semibold">
                  Lines of {document.number}
                  <span className="ml-2 text-xs font-medium text-muted">
                    {document.partyName} · {formatRate(document.due)} still due
                  </span>
                </p>
                <GlassTable className="min-w-[760px]">
                  <thead>
                    <tr className="text-right">
                      <th scope="col" className="text-left">Item</th>
                      <th scope="col">{kind === "credit" ? "Sold" : "Billed"}</th>
                      <th scope="col">Left</th>
                      <th scope="col">{goods ? "Back now" : "Amount off ₹"}</th>
                      <th scope="col">Value ₹</th>
                      <th scope="col">GST ₹</th>
                    </tr>
                  </thead>
                  <tbody className="text-right tabular-nums">
                    {previews.map(({ line, preview }) => (
                      <tr key={line.id} className="align-top">
                        <td className="text-left font-semibold">
                          {line.itemName}
                          <div className="text-xs font-medium text-muted">GST {line.gstRatePct}%</div>
                        </td>
                        <td>
                          {formatQuantity(line.quantity)} {line.unit}
                        </td>
                        <td>
                          {goods ? `${formatQuantity(quantityLeft(line))} ${line.unit}` : formatRate(taxableLeft(line))}
                          {goods && line.inStock !== null && <div className="text-xs text-muted">{formatQuantity(line.inStock)} in stock</div>}
                        </td>
                        <td className="w-[150px]">
                          <TextField
                            label={goods ? `Quantity back of ${line.itemName}` : `Amount off ${line.itemName}`}
                            hideLabel
                            inputMode="decimal"
                            className="text-right"
                            value={(goods ? inputs[line.id]?.quantity : inputs[line.id]?.taxable) ?? ""}
                            onChange={(event) => setInput(line.id, goods ? "quantity" : "taxable", event.target.value)}
                            error={typeof preview === "string" ? preview : undefined}
                          />
                        </td>
                        <td className="font-semibold">{preview && typeof preview === "object" ? formatRate(preview.taxable) : ""}</td>
                        <td>{preview && typeof preview === "object" ? formatRate(preview.tax) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="tabular-nums">
                    <tr className="border-t border-line text-right font-semibold">
                      <td colSpan={4} className="text-left">
                        Note total{totals.roundOff ? ` (round off ${formatRate(totals.roundOff)})` : ""}
                      </td>
                      <td>{formatRate(totals.taxable)}</td>
                      <td>{formatRate(totals.tax)}</td>
                    </tr>
                    <tr className="text-right text-[15px] font-semibold">
                      <td colSpan={5} className="text-left">
                        Takes off what {kind === "credit" ? "the customer owes" : "we owe the vendor"}
                      </td>
                      <td>{formatRate(totals.total)}</td>
                    </tr>
                  </tfoot>
                </GlassTable>
                {overDue && (
                  <p className="text-xs font-semibold text-brand-strong">
                    {document.due > 0 ? `${formatRate(document.due)} settles what is still due on this ${text.against}; ` : `This ${text.against} is already settled, so `}
                    {formatRate(totals.total - document.due)} stays as {kind === "credit" ? "the customer’s" : "our"} credit, to apply to another {text.against} or {kind === "credit" ? "pay back" : "have paid back"}.
                  </p>
                )}
                {result && (
                  <FormMessage tone="error" result={result}>
                    {result.text}
                  </FormMessage>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-muted">Pick the {text.against} on the first step; its lines show here.</p>
            ),
          },
        ]}
        actions={
          <>
            <Link href={text.path} className={buttonClasses("neutral")} tabIndex={-1}>
              Cancel
            </Link>
            <Button type="submit" disabled={busy || !document} data-voucher-accept="">
              {busy ? "Saving…" : `Save the ${text.title.toLowerCase()}`}
            </Button>
          </>
        }
      />
    </form>
  );
}
