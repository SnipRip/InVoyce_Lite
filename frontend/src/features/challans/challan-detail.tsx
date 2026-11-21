"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { CancelDocument } from "@/components/ui/cancel-document";
import { FactTile } from "@/components/ui/fact-tile";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate, formatQuantity, formatRate } from "@/lib/format";
import type { Issuer } from "@/features/invoices/invoice-document";
import type { Party } from "@/features/parties/types";
import type { ChallanView } from "@/types/challan";
import { ChallanDocument } from "./challan-document";
import { cancelChallan, invoiceFromChallanHref, STATUS_TEXT } from "./challans-api";

// One delivery challan: what went, where, the invoice raised from it, and the
// printed challan (in triplicate).
interface ChallanDetailProps {
  challan: ChallanView;
  party: Party | undefined;
  issuer: Issuer;
  onChanged: () => Promise<void>;
}

export function ChallanDetail({ challan, party, issuer, onChanged }: ChallanDetailProps) {
  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <GlassCard className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{challan.number}</CardTitle>
            <StatusChip tone={STATUS_TEXT[challan.status].tone}>{STATUS_TEXT[challan.status].label}</StatusChip>
            <Link href="/delivery-challans" className={buttonClasses("neutral", "ml-auto")}>
              Back to challans
            </Link>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-4">
            <FactTile label="Date">{formatDate(challan.date)}</FactTile>
            <FactTile label="Customer">{challan.partyName}</FactTile>
            <FactTile label="From godown">{challan.godownName}</FactTile>
            <FactTile label="Vehicle">{challan.vehicleNumber ?? "–"}</FactTile>
            {challan.quotation && (
              <FactTile label="Quotation">
                <Link href={`/quotations/${challan.quotation.id}`} className="hover:text-brand hover:underline">
                  {challan.quotation.number}
                </Link>
              </FactTile>
            )}
            {(challan.shipToLine || challan.shipToCity) && <FactTile label="Delivered to">{[challan.shipToLine, challan.shipToCity].filter(Boolean).join(", ")}</FactTile>}
          </dl>
          {challan.notes && <p className="text-sm font-medium text-ink-soft">{challan.notes}</p>}
        </GlassCard>
        <GlassCard className="flex flex-col gap-3">
          <CardTitle>Goods sent</CardTitle>
          <GlassTable className="min-w-[560px]">
            <thead>
              <tr className="text-right">
                <th scope="col" className="text-left">Item</th>
                <th scope="col" className="text-left">HSN</th>
                <th scope="col">Quantity</th>
                <th scope="col">Rate</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody className="text-right font-semibold tabular-nums">
              {challan.lines.map((line) => (
                <tr key={line.id}>
                  <td className="text-left">
                    <Link href={`/items/${line.itemId}`} className="hover:text-brand hover:underline">
                      {line.itemName}
                    </Link>
                    {line.sku && <div className="text-xs font-medium text-muted">{line.sku}</div>}
                  </td>
                  <td className="text-left">{line.hsn ?? ""}</td>
                  <td>
                    {formatQuantity(line.quantity)} {line.unit}
                  </td>
                  <td>{line.rate ? formatRate(line.rate) : ""}</td>
                  <td>{line.rate ? formatRate(line.rate * line.quantity) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line text-right font-semibold tabular-nums">
                <td colSpan={4} className="text-left">
                  Value (for the e-way bill)
                </td>
                <td>{formatRate(challan.value)}</td>
              </tr>
            </tfoot>
          </GlassTable>
        </GlassCard>
        <ChallanDocument challan={challan} party={party} issuer={issuer} />
      </div>
      <GlassCard className="flex flex-col gap-3 xl:sticky xl:top-3.5">
        {challan.status === "OPEN" && (
          <>
            <Link href={invoiceFromChallanHref(challan)} className={buttonClasses("success", undefined, "lg")}>
              Make the invoice
            </Link>
            <p className="text-xs font-medium text-muted">The invoice is filled with these goods; it draws the stock and posts the sale. The challan is then marked invoiced.</p>
            <CancelDocument
              noun="challan"
              effect="The goods it held are free again in the godown and its number is cancelled for good."
              onCancel={async (reason) => {
                await cancelChallan(challan.id, reason);
                await onChanged();
              }}
            />
          </>
        )}
        {challan.invoice && (
          <p className="text-sm font-semibold">
            Invoiced on{" "}
            <Link href={`/invoices/${challan.invoice.id}`} className="text-brand hover:underline">
              {challan.invoice.number}
            </Link>
            .
          </p>
        )}
        {challan.cancelledAt && (
          <p className="text-sm font-semibold text-danger-strong">
            Cancelled {formatDate(challan.cancelledAt.slice(0, 10))}: {challan.cancelReason}.
          </p>
        )}
        <FactTile label="Entered by">{challan.createdBy ?? "–"}</FactTile>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-[18px]" />
          Print challan (3 copies) or save as PDF
        </Button>
      </GlassCard>
    </div>
  );
}
