"use client";

import useSWR from "swr";
import { ComboField } from "@/components/ui/combo-field";
import { SelectField } from "@/components/ui/select-field";
import { apiGet } from "@/lib/api-client";
import { formatRate } from "@/lib/format";
import type { PartySideView } from "@/types/journal";
import type { OpenDocumentView } from "@/types/settlement";
import { documentsPath } from "@/features/payments/settlements-api";
import { sideOf, settlesOutstanding, type JournalLedgerOption } from "./journals-api";

const SIDE_OPTIONS = [
  { value: "RECEIVABLE", label: "What they owe us" },
  { value: "PAYABLE", label: "What we owe them" },
];

interface PartyLineProps {
  option: JournalLedgerOption;
  debit: number;
  credit: number;
  side: string;
  onSide: (side: PartySideView) => void;
  against: string;
  onAgainst: (value: string) => void;
}

// Under a customer or vendor line (client, 13 Nov 2026): which side of their
// outstanding it works on (asked only when the party is both), and for a line
// that settles (a write-off, a discount, a set-off) the one document it is
// set against; the rest stays as their credit. A line that adds to what is
// owed becomes a charge of its own, settled later by a receipt or payment.
export function JournalPartyLine({ option, debit, credit, side, onSide, against, onAgainst }: PartyLineProps) {
  const effective = sideOf(option, side);
  const amount = debit || credit;
  const settles = effective ? settlesOutstanding(effective, { debit, credit }) : false;
  const direction = effective === "PAYABLE" ? "PAYMENT" : "RECEIPT";
  const { data: documents } = useSWR<OpenDocumentView[]>(effective && settles ? documentsPath(direction, option.id) : null, apiGet);
  const open = (documents ?? []).filter((document) => document.balance > 0 && document.kind !== "ADVANCE");
  const owes = effective === "PAYABLE" ? `we owe ${option.label}` : `${option.label} owes`;

  return (
    <div className="grid items-start gap-2.5 rounded-(--radius-tile) bg-ink/[0.03] px-3 py-2.5 @2xl:grid-cols-[200px_minmax(0,1fr)]">
      {option.isCustomer && option.isVendor ? (
        <SelectField label="This line is on" options={SIDE_OPTIONS} value={side || undefined} onValueChange={(value) => onSide(value as PartySideView)} />
      ) : (
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted">This line is on</span>
          <span className="font-semibold">{effective === "PAYABLE" ? "What we owe them" : "What they owe us"}</span>
        </div>
      )}
      {!effective ? (
        <p className="self-center text-xs font-semibold text-muted">Pick whether it is on what they owe us or what we owe them.</p>
      ) : !amount ? (
        <p className="self-center text-xs font-semibold text-muted">Enter the debit or credit.</p>
      ) : settles ? (
        <ComboField
          label="Against (optional)"
          options={open.map((document) => ({ value: `${document.kind}:${document.id}`, label: document.number, detail: `${formatRate(document.balance)} open` }))}
          value={against}
          onChange={onAgainst}
          placeholder={documents ? (open.length ? "Pick the bill or invoice it settles" : "Nothing open: kept as their credit") : "Loading…"}
          hint={`Settles what ${owes}. Without a document, or past what is open on it, it stays as their credit to apply later.`}
        />
      ) : (
        <p className="self-center text-xs font-semibold text-muted">Adds {formatRate(amount)} to what {owes}: settled later by a {direction === "RECEIPT" ? "receipt" : "payment"} like any document.</p>
      )}
    </div>
  );
}
