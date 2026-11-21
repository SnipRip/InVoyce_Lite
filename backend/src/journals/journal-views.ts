// A journal voucher as the API returns it: each line with its ledger's name
// and group, and the voucher type the lines make.
import { HEAD_GROUPS } from '../account-heads/account-head-rules.js';
import { BANK_CASH_GROUPS } from '../bank-cash-accounts/bank-cash-rules.js';
import { isoDate } from '../common/dates.js';
import { toNumber } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CREDIT_ALLOCATION_SELECT, toSettlementOf, type NoteSettlementView } from '../notes/note-views.js';
import { LIVE_CREDIT_SOURCE } from '../settlements/settlements.service.js';
import { journalVoucherType, settlesOutstanding, type JournalLedgerKind, type JournalVoucherType, type PartySide } from './journal-rules.js';

const money = (value: number) => Math.round(value * 100) / 100;

export const journalInclude = {
  createdBy: { select: { displayName: true } },
  lines: {
    orderBy: { position: 'asc' },
    include: {
      ledger: { select: { id: true, name: true, group: { select: { name: true } } } },
      head: { select: { id: true, name: true, nature: true } },
      account: { select: { id: true, name: true, ledgerName: true, kind: true } },
      party: { select: { id: true, displayName: true, isCustomer: true } },
      // A settling party line: what its credit settled.
      creditAllocations: { orderBy: { createdAt: 'asc' }, select: CREDIT_ALLOCATION_SELECT },
      // A charging party line: what settled it (live receipts / payments, live credits).
      settlementAllocations: { where: { settlement: { cancelledAt: null } }, select: { amount: true } },
      chargeAllocations: { where: LIVE_CREDIT_SOURCE, select: { amount: true } },
    },
  },
} satisfies Prisma.JournalVoucherInclude;

type JournalRow = Prisma.JournalVoucherGetPayload<{ include: typeof journalInclude }>;
type LineRow = JournalRow['lines'][number];

export interface JournalLineView {
  /** The line's own id (a charging party line is settled by it). */
  lineId: string;
  kind: JournalLedgerKind;
  id: string;
  /** The ledger name the books know it by. */
  ledger: string;
  group: string;
  debit: number;
  credit: number;
  /** Party lines: the side of the outstanding it works on, and whether it settles or charges. */
  partySide: PartySide | null;
  settles: boolean;
  /** Settling party line: what its credit settled, and what is left to apply. */
  applied: NoteSettlementView[];
  creditLeft: number;
  /** Charging party line: what has been settled on it and what is still open. */
  settled: number;
  balance: number;
}

export interface JournalView {
  id: string;
  number: string;
  date: string;
  type: JournalVoucherType;
  narration: string | null;
  total: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  lines: JournalLineView[];
}

/** The line's ledger as the books name it; the CHECK makes exactly one of the four set. A party has one ledger, under Sundry Debtors if a customer at all (books.service.ts). */
export function lineLedger(line: Pick<LineRow, 'ledger' | 'head' | 'account' | 'party'>): { kind: JournalLedgerKind; id: string; ledger: string; group: string; isMoney: boolean } {
  if (line.party) return { kind: 'party', id: line.party.id, ledger: line.party.displayName, group: line.party.isCustomer ? 'Sundry Debtors' : 'Sundry Creditors', isMoney: false };
  if (line.ledger) return { kind: 'ledger', id: line.ledger.id, ledger: line.ledger.name, group: line.ledger.group?.name ?? 'Primary', isMoney: false };
  if (line.head) return { kind: 'head', id: line.head.id, ledger: line.head.name, group: HEAD_GROUPS[line.head.nature], isMoney: false };
  const account = line.account!;
  return { kind: 'account', id: account.id, ledger: account.ledgerName ?? account.name, group: BANK_CASH_GROUPS[account.kind], isMoney: true };
}

export function toJournalView(row: JournalRow): JournalView {
  const live = !row.cancelledAt;
  const lines = row.lines.map((line) => {
    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);
    const settles = line.partySide ? settlesOutstanding(line.partySide, { debit, credit }) : false;
    const amount = debit || credit;
    const applied = line.creditAllocations.map(toSettlementOf);
    const settled = money([...line.settlementAllocations, ...line.chargeAllocations].reduce((sum, row) => sum + toNumber(row.amount), 0));
    return {
      lineId: line.id,
      ...lineLedger(line),
      debit,
      credit,
      partySide: line.partySide,
      settles,
      applied,
      creditLeft: line.partySide && settles && live ? money(Math.max(amount - applied.reduce((sum, row) => sum + row.amount, 0), 0)) : 0,
      settled: line.partySide && !settles ? settled : 0,
      balance: line.partySide && !settles && live ? money(Math.max(amount - settled, 0)) : 0,
    };
  });
  return {
    id: row.id,
    number: row.number,
    date: isoDate(row.date),
    type: journalVoucherType(lines),
    narration: row.narration,
    total: toNumber(row.total),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    createdBy: row.createdBy?.displayName ?? null,
    lines: lines.map(({ isMoney: _money, ...line }) => line),
  };
}
