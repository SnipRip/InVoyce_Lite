"use client";

import { billedAs } from "@/features/parties/party-branches";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterGroup } from "@/components/ui/filter-group";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassTable } from "@/components/ui/glass-table";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { SearchField } from "@/components/ui/search-field";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusChip } from "@/components/ui/status-chip";
import { stateName } from "@/features/gst/indian-states";
import type { Party } from "@/features/parties/types";
import { formatDayMonth, formatInr, formatQuantity } from "@/lib/format";
import { invoiceStage, invoiceTax, invoiceTotals, missingDocuments, needsEinvoice } from "./invoice-rules";
import { InvoiceStageChip } from "./invoice-stage-chip";
import type { Invoice } from "./types";
import { registrationOn } from "@/features/gst/gst-rules";
import type { OurRegistration } from "@/types/company";

interface InvoicesWorkspaceProps {
  invoices: Invoice[];
  parties: Party[];
  company: OurRegistration;
}

// All sales invoices, with the transport papers each still needs.
export function InvoicesWorkspace({ invoices, parties, company }: InvoicesWorkspaceProps) {
  const [status, setStatus] = useState<"all" | "issued" | "cancelled">("all");
  const [query, setQuery] = useState("");

  const rows = invoices.map((invoice) => {
    const party = billedAs(parties.find((candidate) => candidate.id === invoice.partyId)!, invoice.stored?.billTo?.id);
    const issuedAs = registrationOn(company, invoice.stored?.regime);
    const tax = invoiceTax(issuedAs, invoice, party);
    const totals = invoiceTotals(invoice.lines, tax.regime);
    return { invoice, party, tax, totals, stage: invoiceStage(invoice), missing: missingDocuments(invoice, totals.grandTotal, needsEinvoice(party, issuedAs)) };
  });
  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    ({ invoice, party }) =>
      (status === "all" || invoice.status === status) &&
      (!needle || `${invoice.number} ${party.displayName}`.toLowerCase().includes(needle)),
  );

  const papersMissing = rows.filter((row) => row.invoice.status === "issued" && row.missing.length > 0).length;
  const cancelled = rows.filter((row) => row.invoice.status === "cancelled").length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatTile label="Invoices" value={formatQuantity(rows.length)} />
        {/* Cancelled invoices were never billed: they stay in the list but not in the total. */}
        <StatTile
          label="Billed"
          value={formatInr(rows.filter((row) => row.invoice.status === "issued").reduce((sum, row) => sum + row.totals.grandTotal, 0))}
        />
        <StatTile label="Papers missing" value={formatQuantity(papersMissing)} />
        <StatTile label="Cancelled" value={formatQuantity(cancelled)} />
      </div>

      <GlassCard className="flex flex-col gap-3.5">

        <ListToolbar
          actions={
            <Link href="/invoices/new" className={buttonClasses("primary", undefined, "lg")}>
              <Plus aria-hidden="true" />
              New invoice
            </Link>
          }
        >
          <SearchField
            className="max-w-[340px] flex-[1_1_240px]"
            id="invoice-search"
            label="Search invoices"
            value={query}
            onChange={setQuery}
            placeholder="Search by invoice number or customer"
            trailing={`${visible.length} of ${rows.length}`}
          />
          <FilterGroup label="Invoice status">
            {(["all", "issued", "cancelled"] as const).map((option) => (
              <FilterChip key={option} selected={status === option} onClick={() => setStatus(option)}>
                {option === "all" ? "All invoices" : option === "issued" ? "Issued" : "Cancelled"}
              </FilterChip>
            ))}
          </FilterGroup>
        </ListToolbar>

        <GlassTable className="min-w-[900px]">
          <thead>
            <tr className="text-right">
              <th scope="col" className="text-left">Invoice</th>
              <th scope="col" className="text-left">Customer</th>
              <th scope="col" className="text-left">Tax</th>
              <th scope="col">Taxable</th>
              <th scope="col">Total</th>
              <th scope="col" className="text-left">Stage</th>
              <th scope="col" className="text-left">Documents</th>
            </tr>
          </thead>
          <tbody className="text-right font-semibold tabular-nums">
            {visible.map(({ invoice, party, tax, totals, stage, missing }) => {
              const needed = missing.length + Object.keys(invoice.documents).length;
              return (
                <tr key={invoice.id} className="align-top">
                  <td className="text-left">
                    <Link href={`/invoices/${invoice.id}`} className="font-semibold hover:text-brand hover:underline">
                      {invoice.number}
                    </Link>
                    <div className="text-xs text-muted">
                      {formatDayMonth(invoice.date)}
                    </div>
                  </td>
                  <td className="text-left">
                    <div className="font-semibold">{party.displayName}</div>
                    <div className="text-xs text-muted">{stateName(invoice.placeOfSupply)}</div>
                  </td>
                  <td className="text-left">
                    <StatusChip tone="brand">{tax.title}</StatusChip>
                  </td>
                  <td>{formatInr(totals.taxable)}</td>
                  <td className="font-semibold">{formatInr(totals.grandTotal)}</td>
                  <td className="text-left">
                    <InvoiceStageChip stage={stage} />
                  </td>
                  <td className="text-left text-xs">
                    {invoice.status === "draft" ? (
                      <span className="text-muted">After issue</span>
                    ) : missing.length === 0 ? (
                      <span className="text-success-strong">All attached</span>
                    ) : (
                      <span className="text-warning-strong">
                        {needed - missing.length} of {needed} · missing {missing.length}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </GlassTable>
        {visible.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No invoices match.</p>}
      </GlassCard>
    </div>
  );
}
