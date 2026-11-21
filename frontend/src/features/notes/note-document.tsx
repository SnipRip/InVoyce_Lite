import type { Issuer } from "@/features/invoices/invoice-document";
import type { Party } from "@/features/parties/types";
import { IssuerHeader, PAPER, PartyBlock, SignatureFooter } from "@/features/print/print-parts";
import { amountInWords } from "@/lib/amount-in-words";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import type { CreditNoteView, DebitNoteView } from "@/types/note";
import { reasonLabel, type NoteKind } from "./notes-api";

// The printed credit or debit note, with what CGST rule 53(1A) asks of one:
// nature of the document, its number and date, the party's name, address
// and GSTIN, the invoice it revises (number and date), and per line the
// value, rate and tax taken back, signed. A note without GST (a discount not
// agreed at the sale, s.15(3)(b)) prints no GST column and says why. A
// cancelled note prints CANCELLED. Printed through `.print-area`.
export function NoteDocument({ kind, note, party, issuer }: { kind: NoteKind; note: CreditNoteView | DebitNoteView; party: Party | undefined; issuer: Issuer }) {
  const credit = "invoiceNumber" in note ? note : null;
  const debit = "billReference" in note ? note : null;
  const goods = note.reason === "GOODS_RETURNED";
  const withGst = note.gstAdjusted;
  const lut = credit?.regime === "EXPORT_LUT";
  const taxRows = [
    ...(note.cgst ? [{ name: "CGST", amount: note.cgst }] : []),
    ...(note.sgst ? [{ name: "SGST", amount: note.sgst }] : []),
    ...(note.igst ? [{ name: "IGST", amount: note.igst }] : []),
  ];

  return (
    <article className={`print-area ${PAPER}`}>
      <IssuerHeader issuer={issuer} title={kind === "credit" ? "CREDIT NOTE" : "DEBIT NOTE"}>
        <p className="text-[13px] font-semibold">{reasonLabel(note.reason)}</p>
        {note.cancelledAt && <p className="text-[13px] font-semibold text-danger-strong">CANCELLED</p>}
        <p className="text-[11px] font-semibold text-muted">Original for recipient</p>
      </IssuerHeader>

      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        <PartyBlock heading={kind === "credit" ? "Issued to (customer)" : "Issued to (vendor)"} party={party} fallbackName={note.partyName} />
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3">
          <dt className="font-semibold text-muted">Note no.</dt>
          <dd className="font-semibold">{note.number}</dd>
          <dt className="font-semibold text-muted">Date</dt>
          <dd>{formatDate(note.date)}</dd>
          {credit && (
            <>
              <dt className="font-semibold text-muted">Against invoice</dt>
              <dd>
                {credit.invoiceNumber} dated {formatDate(credit.invoiceDate)}
              </dd>
            </>
          )}
          {debit && (
            <>
              <dt className="font-semibold text-muted">Against your invoice</dt>
              <dd>
                {debit.vendorBillNumber} dated {formatDate(debit.billDate)}
              </dd>
              <dt className="font-semibold text-muted">Our reference</dt>
              <dd>{debit.billReference}</dd>
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
              {goods && <th className="py-1.5">Qty</th>}
              <th className="py-1.5">{withGst ? "Taxable value" : "Value"}</th>
              {withGst && <th className="py-1.5">GST rate</th>}
              {withGst && <th className="py-1.5">GST</th>}
              <th className="py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {note.lines.map((line, index) => (
              <tr key={line.id} className="border-b border-line align-top">
                <td className="py-1.5 text-left">{index + 1}</td>
                <td className="py-1.5 text-left font-semibold">
                  {line.itemName}
                  {line.sku && <div className="text-[10px] font-normal">{line.sku}</div>}
                </td>
                {goods && (
                  <td className="py-1.5">
                    {formatQuantity(line.quantity)} {line.unit}
                  </td>
                )}
                <td className="py-1.5">{formatRate(line.taxable)}</td>
                {withGst && <td className="py-1.5">{lut ? "0% (LUT)" : `${line.gstRatePct}%`}</td>}
                {withGst && <td className="py-1.5">{formatRate(line.tax)}</td>}
                <td className="py-1.5 font-semibold">{formatRate(line.taxable + (withGst ? line.tax : 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-3 grid gap-3.5 sm:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-2">
          <p>
            <span className="font-semibold">Amount in words: </span>
            {amountInWords(note.total)}
          </p>
          {!withGst && (
            <p className="font-semibold">
              No GST is reduced on this note: a discount not agreed at the time of supply (CGST Act s.15(3)(b)).
            </p>
          )}
          {debit && debit.itcReversed > 0 && <p>Input tax credit given back: {formatRate(debit.itcReversed)}</p>}
          {note.notes && <p>{note.notes}</p>}
        </div>
        <dl className="flex flex-col gap-0.5 tabular-nums">
          <div className="flex justify-between">
            <dt>{withGst ? "Taxable value" : "Value"}</dt>
            <dd>{formatRate(note.taxable)}</dd>
          </div>
          {taxRows.map((row) => (
            <div key={row.name} className="flex justify-between">
              <dt>{row.name}</dt>
              <dd>{formatRate(row.amount)}</dd>
            </div>
          ))}
          {note.roundOff !== 0 && (
            <div className="flex justify-between">
              <dt>Round off</dt>
              <dd>{formatRate(note.roundOff)}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t-2 border-ink pt-1 text-[14px] font-semibold">
            <dt>Total</dt>
            <dd>{formatRate(note.total)}</dd>
          </div>
          {/* An export with IGST paid: the customer paid the goods value only, so only that is credited to them. */}
          {note.partyAmount !== note.total && (
            <div className="flex justify-between font-semibold">
              <dt>Credited to you</dt>
              <dd>{formatRate(note.partyAmount)}</dd>
            </div>
          )}
        </dl>
      </section>

      <SignatureFooter
        issuer={issuer}
        note={`Certified that the particulars given above are true and correct.${kind === "credit" ? " This amount is credited to your account with us." : " This amount is debited to your account in our books."}`}
      />
    </article>
  );
}
