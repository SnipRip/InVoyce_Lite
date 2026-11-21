import clsx from "clsx";
import { stateName } from "@/features/gst/indian-states";
import type { Issuer } from "@/features/invoices/invoice-document";
import type { Party } from "@/features/parties/types";
import { IssuerHeader, PAPER, PartyBlock, SignatureFooter } from "@/features/print/print-parts";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import type { ChallanView } from "@/types/challan";

// The printed delivery challan, with what CGST rule 55 asks of one: its
// number and date, our name, address and GSTIN, the consignee's, the place
// it goes, and per line the HSN, description, quantity and value; signed.
// Rule 55(2) wants it in triplicate, so one print gives all three copies on
// separate pages (the screen shows the original). Printed through `.print-area`.
const COPIES = ["Original for consignee", "Duplicate for transporter", "Triplicate for consignor"] as const;

export function ChallanDocument({ challan, party, issuer }: { challan: ChallanView; party: Party | undefined; issuer: Issuer }) {
  const deliverTo = challan.shipToLine || challan.shipToCity ? [challan.shipToLine, challan.shipToCity].filter(Boolean).join(", ") : null;
  const placeOfSupply = party?.billing.stateCode ? `${stateName(party.billing.stateCode)} (${party.billing.stateCode})` : null;
  return (
    <article className={`print-area ${PAPER}`}>
      {COPIES.map((copy, index) => (
        <section key={copy} className={clsx(index > 0 && "hidden break-before-page print:block")}>
          <IssuerHeader issuer={issuer} title="DELIVERY CHALLAN">
            {challan.cancelledAt && <p className="text-[13px] font-semibold text-danger-strong">CANCELLED</p>}
            <p className="text-[11px] font-semibold text-muted">{copy}</p>
          </IssuerHeader>

          <section className="mt-3 grid gap-3 sm:grid-cols-3">
            <PartyBlock heading="Consignee" party={party} fallbackName={challan.partyName} />
            <div>
              <p className="font-semibold text-muted">Deliver to</p>
              <p>{deliverTo ?? "As the consignee's address"}</p>
              <p className="mt-1 font-semibold text-muted">Dispatched from</p>
              <p>{challan.godownName}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3">
              <dt className="font-semibold text-muted">Challan no.</dt>
              <dd className="font-semibold">{challan.number}</dd>
              <dt className="font-semibold text-muted">Date</dt>
              <dd>{formatDate(challan.date)}</dd>
              {placeOfSupply && (
                <>
                  <dt className="font-semibold text-muted">Place of supply</dt>
                  <dd>{placeOfSupply}</dd>
                </>
              )}
              {challan.vehicleNumber && (
                <>
                  <dt className="font-semibold text-muted">Vehicle</dt>
                  <dd>{challan.vehicleNumber}</dd>
                </>
              )}
              {challan.quotation && (
                <>
                  <dt className="font-semibold text-muted">Quotation</dt>
                  <dd>{challan.quotation.number}</dd>
                </>
              )}
              {challan.invoice && (
                <>
                  <dt className="font-semibold text-muted">Invoice</dt>
                  <dd>{challan.invoice.number}</dd>
                </>
              )}
            </dl>
          </section>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-right tabular-nums">
              <thead>
                <tr className="border-y border-ink text-[11px]">
                  <th className="py-1.5 text-left">#</th>
                  <th className="py-1.5 text-left">Description</th>
                  <th className="py-1.5 text-left">HSN</th>
                  <th className="py-1.5">Qty</th>
                  <th className="py-1.5">Rate</th>
                  <th className="py-1.5">Value</th>
                </tr>
              </thead>
              <tbody>
                {challan.lines.map((line, lineIndex) => (
                  <tr key={line.id} className="border-b border-line align-top">
                    <td className="py-1.5 text-left">{lineIndex + 1}</td>
                    <td className="py-1.5 text-left font-semibold">
                      {line.itemName}
                      {line.description && <div className="text-[10px] font-normal">{line.description}</div>}
                    </td>
                    <td className="py-1.5 text-left">{line.hsn ?? ""}</td>
                    <td className="py-1.5">
                      {formatQuantity(line.quantity)} {line.unit}
                    </td>
                    <td className="py-1.5">{line.rate ? formatRate(line.rate) : ""}</td>
                    <td className="py-1.5 font-semibold">{line.rate ? formatRate(line.rate * line.quantity) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink text-[13px] font-semibold">
                  <td colSpan={5} className="py-1.5 text-left">
                    Value of goods
                  </td>
                  <td className="py-1.5">{formatRate(challan.value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3">Goods sent on delivery challan; the tax invoice follows. Not a bill: no payment is due on this challan.</p>
          {challan.notes && <p className="mt-1">{challan.notes}</p>}

          <SignatureFooter issuer={issuer} note="Received the goods above in good condition." partySignature="Receiver's signature and date" />
        </section>
      ))}
    </article>
  );
}
