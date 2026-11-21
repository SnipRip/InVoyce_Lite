// Stock in a godown and what open delivery challans hold back from it, for
// challans and for invoices that are not raised from a challan.
import type { Prisma } from '../generated/prisma/client.js';
import { toNumber } from '../common/decimal.js';
import type { ChallanStock } from './challan-rules.js';

type Db = Prisma.TransactionClient;
const n = (value: Prisma.Decimal | null) => toNumber(value) ?? 0;

/**
 * Per item: on hand in the godown (opening left plus batches remaining) and
 * on open challans from it, leaving out `exceptChallanId` (the challan an
 * invoice is raised from: its goods are the ones being billed).
 */
export async function challanStock(db: Db, godownId: string, itemIds: string[], exceptChallanId?: string): Promise<Map<string, ChallanStock>> {
  const ids = [...new Set(itemIds)];
  const [items, batches, openings, held] = await Promise.all([
    db.item.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    db.stockBatch.groupBy({ by: ['itemId'], where: { godownId, itemId: { in: ids } }, _sum: { remaining: true } }),
    db.itemOpeningStock.findMany({ where: { godownId, itemId: { in: ids } }, select: { itemId: true, quantity: true, drawn: true } }),
    db.deliveryChallanLine.groupBy({
      by: ['itemId'],
      where: { itemId: { in: ids }, challan: { godownId, status: 'OPEN', ...(exceptChallanId && { id: { not: exceptChallanId } }) } },
      _sum: { quantity: true },
    }),
  ]);
  const stock = new Map<string, ChallanStock>();
  for (const item of items) {
    const batch = batches.find((row) => row.itemId === item.id);
    const opening = openings.filter((row) => row.itemId === item.id).reduce((sum, row) => sum + n(row.quantity) - n(row.drawn), 0);
    stock.set(item.id, {
      name: item.name,
      onHand: Math.round((n(batch?._sum.remaining ?? null) + opening) * 1000) / 1000,
      onChallans: n(held.find((row) => row.itemId === item.id)?._sum.quantity ?? null),
    });
  }
  return stock;
}
