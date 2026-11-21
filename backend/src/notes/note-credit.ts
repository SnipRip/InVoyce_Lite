// A note's credit with the party (client, 13 Nov 2026): what the note takes
// off the party, less what it settled (its own document first, then any
// other document it was applied to) and what live refunds gave back.
import type { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

type Db = Prisma.TransactionClient | PrismaService;

/** Where a party's credit comes from: a credit note, a debit note, or a settling journal line. */
export type NoteKind = 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'JOURNAL';

const money = (value: number) => Math.round(value * 100) / 100;
const num = (value: Prisma.Decimal | number | null) => (value === null ? 0 : typeof value === 'number' ? value : value.toNumber());

/** What a credit note takes off what the customer owes. */
export const creditNotePartyAmount = (note: { total: Prisma.Decimal | number }) => money(num(note.total));

/** What a debit note takes off what we owe the vendor. */
export const debitNotePartyAmount = (note: { total: Prisma.Decimal | number }) => money(num(note.total));

/** What each note has settled (allocations) and what live refunds gave back, by note id. */
export async function noteUsage(db: Db, kind: NoteKind, ids: string[]): Promise<Map<string, { allocated: number; refunded: number }>> {
  const result = new Map<string, { allocated: number; refunded: number }>();
  if (!ids.length) return result;
  for (const id of ids) result.set(id, { allocated: 0, refunded: 0 });
  if (kind === 'JOURNAL') {
    // A journal's credit is applied, never refunded on its own (a refund is another journal or a payment).
    const rows = await db.noteAllocation.groupBy({ by: ['journalLineId'], where: { journalLineId: { in: ids } }, _sum: { amount: true } });
    for (const row of rows) result.get(row.journalLineId!)!.allocated = money(num(row._sum.amount));
    return result;
  }
  const credit = kind === 'CREDIT_NOTE';
  const [allocated, refunded] = await Promise.all([
    credit
      ? db.noteAllocation.groupBy({ by: ['creditNoteId'], where: { creditNoteId: { in: ids } }, _sum: { amount: true } })
      : db.noteAllocation.groupBy({ by: ['debitNoteId'], where: { debitNoteId: { in: ids } }, _sum: { amount: true } }),
    credit
      ? db.settlementAllocation.groupBy({ by: ['creditNoteId'], where: { creditNoteId: { in: ids }, settlement: { cancelledAt: null } }, _sum: { amount: true } })
      : db.settlementAllocation.groupBy({ by: ['debitNoteId'], where: { debitNoteId: { in: ids }, settlement: { cancelledAt: null } }, _sum: { amount: true } }),
  ]);
  const idOf = (row: { creditNoteId?: string | null; debitNoteId?: string | null }) => (credit ? row.creditNoteId : row.debitNoteId)!;
  for (const row of allocated) result.get(idOf(row))!.allocated = money(num(row._sum.amount));
  for (const row of refunded) result.get(idOf(row))!.refunded = money(num(row._sum.amount));
  return result;
}

/** What is still the party's credit on a note. */
export const creditLeft = (partyAmount: number, usage: { allocated: number; refunded: number }) =>
  money(Math.max(partyAmount - usage.allocated - usage.refunded, 0));
