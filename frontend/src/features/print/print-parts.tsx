import type { ReactNode } from "react";
import { stateName } from "@/features/gst/indian-states";
import type { Issuer } from "@/features/invoices/invoice-document";
import type { Party } from "@/features/parties/types";

// Pieces every printed document shares (challans, credit and debit notes):
// white paper printed through `.print-area` (globals.css), our letterhead on
// the left and the document's title on the right, the party's block, and the
// signature line.

export const PAPER = "rounded-(--radius-tile) bg-white p-6 text-[12px] leading-snug text-ink shadow-[0_10px_40px_rgb(20_40_90/0.12)] sm:p-8";

export function IssuerHeader({ issuer, title, children }: { issuer: Issuer; title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3.5 border-b-2 border-ink pb-3">
      <div>
        <p className="text-lg font-semibold">{issuer.legalName}</p>
        <p>{issuer.address}</p>
        <p>
          {issuer.phone} · {issuer.email}
        </p>
        <p className="font-semibold">
          {issuer.registration === "UNREGISTERED" ? "Not registered under GST" : `GSTIN ${issuer.gstin ?? "[to be added]"}`} · State {stateName(issuer.stateCode)} (
          {issuer.stateCode})
        </p>
      </div>
      <div className="text-right">
        <p className="text-xl font-semibold tracking-wide">{title}</p>
        {children}
      </div>
    </header>
  );
}

/** Name, address and GSTIN (or foreign tax id) of the party, under a small heading. */
export function PartyBlock({ heading, party, fallbackName }: { heading: string; party: Party | undefined; fallbackName: string }) {
  const street = party ? [party.billing.line1, party.billing.city, party.billing.pin].filter(Boolean).join(", ") : "";
  return (
    <div>
      <p className="font-semibold text-muted">{heading}</p>
      <p className="font-semibold">{party?.legalName ?? party?.displayName ?? fallbackName}</p>
      {party && (
        <>
          {street && <p>{street}</p>}
          <p>{party.billing.country ?? stateName(party.billing.stateCode)}</p>
          {party.gstin && <p className="font-semibold">GSTIN {party.gstin}</p>}
          {party.foreignTaxId && <p className="font-semibold">Tax ID {party.foreignTaxId}</p>}
        </>
      )}
    </div>
  );
}

/** The two signatures at the foot: the party's on the left (when asked), ours on the right. */
export function SignatureFooter({ issuer, note, partySignature }: { issuer: Issuer; note: string; partySignature?: string }) {
  return (
    <footer className="mt-10 flex items-end justify-between gap-3.5 text-[11px]">
      <div className="max-w-[55%]">
        <p className="text-muted">{note}</p>
        {partySignature && <p className="mt-10 w-[200px] border-t border-ink pt-1">{partySignature}</p>}
      </div>
      <div className="text-right">
        <p className="font-semibold">For {issuer.legalName}</p>
        <p className="mt-8 border-t border-ink pt-1">Authorised signatory</p>
      </div>
    </footer>
  );
}
