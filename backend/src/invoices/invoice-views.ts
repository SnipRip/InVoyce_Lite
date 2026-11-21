// Invoices as the API returns them: Decimals as numbers, dates as YYYY-MM-DD.
// Each line carries its FIFO draws, so the screen can show where the goods
// (and their cost) came from.
import { branchSelect } from '../parties/party-branch.js';
import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';
import { enteredView } from '../items/line-units.js';
import type { AppliedScheme } from '../schemes/scheme-rules.js';
import { batchSourceSelect, drawSource } from '../stock/draw-source.js';
import { DOCUMENT_RULES, type DocumentDetails } from './dispatch-document-rules.js';

const DOCUMENT_ORDER = Object.keys(DOCUMENT_RULES);

export const invoiceInclude = {
  party: { select: { displayName: true } },
  billToBranch: branchSelect,
  shipToBranch: branchSelect,
  godown: { select: { name: true } },
  quotation: { select: { id: true, number: true, revision: true } },
  documents: {
    select: {
      kind: true,
      number: true,
      date: true,
      details: true,
      updatedAt: true,
    },
  },
  // Live receipts applied to it (src/settlements).
  allocations: { where: { settlement: { cancelledAt: null } }, select: { amount: true } },
  // Live credit notes against it (src/notes).
  creditNotes: { where: { cancelledAt: null }, orderBy: { date: 'asc' }, select: { id: true, number: true, date: true, total: true } },
  // What live credit notes settle on it: its own notes up to what was due, and other notes' credit applied to it.
  noteAllocations: { where: { OR: [{ creditNote: { is: { cancelledAt: null } } }, { debitNote: { is: { cancelledAt: null } } }, { journalLine: { is: { journal: { cancelledAt: null } } } }] }, select: { amount: true } },
  lines: {
    orderBy: { position: 'asc' },
    include: {
      draws: { select: { quantity: true, rate: true, batch: batchSourceSelect } },
    },
  },
} as const satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export const toInvoiceView = (invoice: InvoiceRow) => ({
  id: invoice.id,
  number: invoice.number,
  date: isoDate(invoice.date),
  partyId: invoice.partyId,
  partyName: invoice.party.displayName,
  // Null: the customer's main branch (bill to) / the bill-to address (ship to).
  billTo: invoice.billToBranch,
  shipTo: invoice.shipToBranch,
  godownId: invoice.godownId,
  godownName: invoice.godown.name,
  status: invoice.status,
  regime: invoice.regime,
  gstApplicable: invoice.gstApplicable,
  placeOfSupply: invoice.placeOfSupply,
  shipToLine: invoice.shipToLine,
  shipToCity: invoice.shipToCity,
  vehicleNumber: invoice.vehicleNumber,
  vehicleId: invoice.vehicleId,
  notes: invoice.notes,
  quotation: invoice.quotation && {
    id: invoice.quotation.id,
    label: invoice.quotation.revision ? `${invoice.quotation.number}-R${invoice.quotation.revision}` : invoice.quotation.number,
  },
  totals: {
    gross: toNumber(invoice.gross),
    schemeDiscount: toNumber(invoice.schemeDiscount),
    taxable: toNumber(invoice.taxable),
    cgst: toNumber(invoice.cgst),
    sgst: toNumber(invoice.sgst),
    igst: toNumber(invoice.igst),
    tax: toNumber(invoice.tax),
    roundOff: toNumber(invoice.roundOff),
    total: toNumber(invoice.total),
    /** Received so far: live receipts (and TDS) applied to this invoice. */
    received: Math.round(invoice.allocations.reduce((sum, allocation) => sum + toNumber(allocation.amount), 0) * 100) / 100,
    /** Settled by live credit notes and journals (a note's excess over what was due is the customer's credit, not this invoice's). */
    credited: Math.round(invoice.noteAllocations.reduce((sum, allocation) => sum + toNumber(allocation.amount), 0) * 100) / 100,
    cost: toNumber(invoice.cost),
  },
  creditNotes: invoice.creditNotes.map((note) => ({ id: note.id, number: note.number, date: isoDate(note.date), total: toNumber(note.total) })),
  lines: invoice.lines.map((line) => ({
    id: line.id,
    itemId: line.itemId,
    description: line.description,
    hsn: line.hsn,
    unit: line.unit,
    quantity: toNumber(line.quantity),
    rate: toNumber(line.rate),
    entered: enteredView(line, line.unit),
    discountPct: toNumber(line.discountPct),
    rateSource: line.rateSource,
    suggestedRate: toNumber(line.suggestedRate),
    schemeDiscount: toNumber(line.schemeDiscount),
    freeQuantity: toNumber(line.freeQuantity),
    schemes: line.schemes as unknown as AppliedScheme[],
    gstRatePct: toNumber(line.gstRatePct),
    taxable: toNumber(line.taxable),
    tax: toNumber(line.tax),
    costOfGoods: toNumber(line.costOfGoods),
    /** Oldest first, with where each slice came from. Empty once cancelled (the stock went back). */
    draws: line.draws
      .map((draw) => ({
        quantity: toNumber(draw.quantity),
        rate: toNumber(draw.rate),
        source: drawSource(draw.batch),
        batchDate: draw.batch ? isoDate(draw.batch.date) : null,
      }))
      .sort((a, b) => (a.batchDate ?? '').localeCompare(b.batchDate ?? '')),
  })),
  /** Attached dispatch documents, in the order they happen (enum order). */
  documents: invoice.documents
    .map((document) => ({
      kind: document.kind,
      number: document.number,
      date: isoDate(document.date),
      details: document.details as DocumentDetails,
      updatedAt: document.updatedAt,
    }))
    .sort((a, b) => DOCUMENT_ORDER.indexOf(a.kind) - DOCUMENT_ORDER.indexOf(b.kind)),
  cancelledAt: invoice.cancelledAt,
  cancelReason: invoice.cancelReason,
  createdAt: invoice.createdAt,
});

export type InvoiceView = ReturnType<typeof toInvoiceView>;
