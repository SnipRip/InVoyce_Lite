// Credit and debit notes as the API returns them.
import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { NoteReason, SaleRegime } from '../generated/prisma/enums.js';
import { creditNotePartyAmount, debitNotePartyAmount } from './note-credit.js';

const n = (value: Prisma.Decimal | null) => toNumber(value) ?? 0;

/** What a credit allocation names of its target. */
export const CREDIT_ALLOCATION_SELECT = {
  amount: true,
  createdAt: true,
  invoiceId: true,
  billId: true,
  expenseId: true,
  openingPartyId: true,
  journalChargeId: true,
  invoice: { select: { number: true } },
  bill: { select: { reference: true } },
  expense: { select: { number: true } },
  journalCharge: { select: { journalId: true, journal: { select: { number: true } } } },
} as const satisfies Prisma.NoteAllocationSelect;


export const creditNoteInclude = {
  allocations: {
    orderBy: { createdAt: 'asc' },
    select: CREDIT_ALLOCATION_SELECT,
  },
  refunds: {
    where: { settlement: { cancelledAt: null } },
    orderBy: { createdAt: 'asc' },
    select: { amount: true, settlement: { select: { id: true, number: true, date: true } } },
  },
  invoice: { select: { number: true, date: true } },
  party: { select: { displayName: true } },
  godown: { select: { name: true } },
  createdBy: { select: { displayName: true } },
  lines: {
    orderBy: { position: 'asc' },
    include: {
      item: { select: { name: true, sku: true } },
      invoiceLine: { select: { unit: true } },
      batch: { select: { quantity: true, remaining: true } },
    },
  },
} satisfies Prisma.CreditNoteInclude;

export const debitNoteInclude = {
  allocations: {
    orderBy: { createdAt: 'asc' },
    select: CREDIT_ALLOCATION_SELECT,
  },
  refunds: {
    where: { settlement: { cancelledAt: null } },
    orderBy: { createdAt: 'asc' },
    select: { amount: true, settlement: { select: { id: true, number: true, date: true } } },
  },
  bill: { select: { reference: true, vendorBillNumber: true, date: true } },
  party: { select: { displayName: true } },
  createdBy: { select: { displayName: true } },
  lines: { orderBy: { position: 'asc' }, include: { item: { select: { name: true, sku: true } }, billLine: { select: { unit: true } } } },
} satisfies Prisma.DebitNoteInclude;

export interface NoteLineView {
  id: string;
  /** The invoice line or bill line it takes back from. */
  documentLineId: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  unit: string;
  quantity: number;
  taxable: number;
  gstRatePct: number;
  tax: number;
  cost: number;
}

interface NoteViewBase {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  reason: NoteReason;
  /** False: a note without GST (financial credit / debit note). */
  gstAdjusted: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  total: number;
  cost: number;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  lines: NoteLineView[];
  /** What the note takes off the party. */
  partyAmount: number;
  /** What it settles: its own document first, then any it was applied to later. */
  settles: NoteSettlementView[];
  /** Live refunds of its credit (a payment to the customer, a receipt from the vendor). */
  refunds: { id: string; number: string; date: string; amount: number }[];
  /** Still the party's credit: to apply to another document or refund. */
  creditLeft: number;
}

export interface NoteSettlementView {
  kind: 'INVOICE' | 'BILL' | 'EXPENSE' | 'OPENING' | 'JOURNAL';
  documentId: string;
  number: string;
  amount: number;
  appliedAt: string;
  /** JOURNAL: the journal the charging line is on. */
  journalId?: string;
}

type CreditAllocationRow = Prisma.NoteAllocationGetPayload<{ select: typeof CREDIT_ALLOCATION_SELECT }>;

/** A credit allocation as the screens show it: what it settled and how much. */
export const toSettlementOf = (allocation: CreditAllocationRow): NoteSettlementView => ({
  kind: allocation.invoiceId ? 'INVOICE' : allocation.billId ? 'BILL' : allocation.expenseId ? 'EXPENSE' : allocation.journalChargeId ? 'JOURNAL' : 'OPENING',
  documentId: (allocation.invoiceId ?? allocation.billId ?? allocation.expenseId ?? allocation.journalChargeId ?? allocation.openingPartyId)!,
  number: allocation.invoice?.number ?? allocation.bill?.reference ?? allocation.expense?.number ?? allocation.journalCharge?.journal.number ?? 'Opening balance',
  amount: n(allocation.amount),
  appliedAt: allocation.createdAt.toISOString(),
  ...(allocation.journalCharge ? { journalId: allocation.journalCharge.journalId } : {}),
});

export interface CreditNoteView extends NoteViewBase {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  regime: SaleRegime;
  godownId: string | null;
  godownName: string | null;
  /** Goods it brought back have been sold or moved since, so it cannot be cancelled. */
  usedSince: boolean;
}

export interface DebitNoteView extends NoteViewBase {
  billId: string;
  billReference: string;
  vendorBillNumber: string;
  billDate: string;
  itcReversed: number;
}

type CreditRow = Prisma.CreditNoteGetPayload<{ include: typeof creditNoteInclude }>;
type DebitRow = Prisma.DebitNoteGetPayload<{ include: typeof debitNoteInclude }>;

const money = (value: number) => Math.round(value * 100) / 100;

/** What the note settled and refunded, and the credit left of `partyAmount`. */
function usageOf(row: CreditRow | DebitRow, partyAmount: number) {
  const settles = row.allocations.map(toSettlementOf);
  const refunds = row.refunds.map((refund) => ({ id: refund.settlement.id, number: refund.settlement.number, date: isoDate(refund.settlement.date), amount: n(refund.amount) }));
  const used = settles.reduce((sum, item) => sum + item.amount, 0) + refunds.reduce((sum, item) => sum + item.amount, 0);
  return { partyAmount, settles, refunds, creditLeft: row.cancelledAt ? 0 : money(Math.max(partyAmount - used, 0)) };
}

const base = (row: CreditRow | DebitRow) => ({
  id: row.id,
  number: row.number,
  date: isoDate(row.date),
  partyId: row.partyId,
  partyName: row.party.displayName,
  reason: row.reason,
  gstAdjusted: row.gstAdjusted,
  taxable: n(row.taxable),
  cgst: n(row.cgst),
  sgst: n(row.sgst),
  igst: n(row.igst),
  tax: n(row.tax),
  roundOff: n(row.roundOff),
  total: n(row.total),
  cost: n(row.cost),
  notes: row.notes,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  cancelReason: row.cancelReason,
  createdBy: row.createdBy?.displayName ?? null,
});

export function toCreditNoteView(row: CreditRow): CreditNoteView {
  return {
    ...base(row),
    ...usageOf(row, creditNotePartyAmount(row)),
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice.number,
    invoiceDate: isoDate(row.invoice.date),
    regime: row.regime,
    godownId: row.godownId,
    godownName: row.godown?.name ?? null,
    usedSince: row.lines.some((line) => line.batch !== null && n(line.batch.remaining) < n(line.batch.quantity)),
    lines: row.lines.map((line) => ({
      id: line.id,
      documentLineId: line.invoiceLineId,
      itemId: line.itemId,
      itemName: line.item.name,
      sku: line.item.sku,
      unit: line.invoiceLine.unit,
      quantity: n(line.quantity),
      taxable: n(line.taxable),
      gstRatePct: n(line.gstRatePct),
      tax: n(line.tax),
      cost: n(line.cost),
    })),
  };
}

export function toDebitNoteView(row: DebitRow): DebitNoteView {
  return {
    ...base(row),
    ...usageOf(row, debitNotePartyAmount(row)),
    billId: row.billId,
    billReference: row.bill.reference,
    vendorBillNumber: row.bill.vendorBillNumber,
    billDate: isoDate(row.bill.date),
    itcReversed: n(row.itcReversed),
    lines: row.lines.map((line) => ({
      id: line.id,
      documentLineId: line.billLineId,
      itemId: line.itemId,
      itemName: line.item.name,
      sku: line.item.sku,
      unit: line.billLine.unit,
      quantity: n(line.quantity),
      taxable: n(line.taxable),
      gstRatePct: n(line.gstRatePct),
      tax: n(line.tax),
      cost: n(line.cost),
    })),
  };
}
