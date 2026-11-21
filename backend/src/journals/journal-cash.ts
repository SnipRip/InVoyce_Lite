// Cash received from one party on one day, across receipts and journals, for
// the s.269ST limit (Income-tax Act: ₹2 lakh or more in a day is barred).
// Both savers lock the party first, so two saves for one party never race.
import { toNumber } from '../common/decimal.js';
import type { Prisma } from '../generated/prisma/client.js';
import { cashByParty, type CashLineInput } from './journal-rules.js';

type Tx = Prisma.TransactionClient;

/** Cash the party paid in on the day: live cash receipts plus the cash its live journals took in. */
export async function cashReceivedOn(tx: Tx, partyId: string, date: Date): Promise<number> {
  const [receipts, journals] = await Promise.all([
    tx.settlement.aggregate({ where: { direction: 'RECEIPT', mode: 'CASH', partyId, date, cancelledAt: null }, _sum: { amount: true } }),
    tx.journalVoucher.findMany({
      where: { date, cancelledAt: null, lines: { some: { partyId } } },
      select: { lines: { select: { partyId: true, accountId: true, debit: true, credit: true, account: { select: { kind: true } } } } },
    }),
  ]);
  const fromJournals = journals.reduce((sum, journal) => {
    const lines: CashLineInput[] = journal.lines.map((line, index) => ({
      kind: line.partyId ? 'party' : line.accountId ? 'account' : 'ledger',
      id: line.partyId ?? line.accountId ?? String(index),
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      isCash: line.account?.kind === 'CASH',
    }));
    return sum + (cashByParty(lines).get(partyId)?.received ?? 0);
  }, 0);
  return Math.round(((receipts._sum.amount?.toNumber() ?? 0) + fromJournals) * 100) / 100;
}
