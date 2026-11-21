// Stock out and batch locks both stock-move services share, inside their
// transactions.
import { ConflictException } from '@nestjs/common';
import { lockRows } from '../database/sql.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ItemDocumentFacts } from '../items/item-document-facts.js';
import type { StockDraw } from '../stock/fifo-rules.js';
import { drawStock } from '../stock/stock-out.js';

type Tx = Prisma.TransactionClient;

interface DrawLinesRequest {
  godownId: string;
  godownName: string;
  date: string;
  /** "this transfer", for the refusal when stock is short. */
  document: string;
  lines: { itemId: string; quantity: number }[];
  facts: Map<string, ItemDocumentFacts>;
}

/**
 * Draws every line FIFO from the godown, in item order like invoices, so two
 * documents lock the same rows in the same order and never deadlock.
 * Returns the draws by line index.
 */
export async function drawLines(tx: Tx, request: DrawLinesRequest): Promise<StockDraw[][]> {
  const { lines, facts } = request;
  const order = [...lines.keys()].sort((a, b) => lines[a].itemId.localeCompare(lines[b].itemId) || a - b);
  const draws: StockDraw[][] = [];
  for (const index of order) {
    const line = lines[index];
    const item = facts.get(line.itemId)!;
    draws[index] = await drawStock(tx, {
      itemId: line.itemId,
      godownId: request.godownId,
      date: request.date,
      quantity: line.quantity,
      label: { item: item.name, unit: item.unit, godown: request.godownName, document: request.document },
    });
  }
  return draws;
}

/**
 * Locks the batches a document made and refuses when any has been drawn
 * since: that stock has been sold or moved on, so the document cannot be
 * undone. Returns their ids for deleting.
 */
export async function lockUntouchedBatches(tx: Tx, where: Prisma.StockBatchWhereInput, refusal: string): Promise<string[]> {
  const ids = (await tx.stockBatch.findMany({ where, select: { id: true } })).map((batch) => batch.id);
  await lockRows(tx, 'StockBatch', ids);
  const batches = await tx.stockBatch.findMany({ where: { id: { in: ids } }, select: { remaining: true, quantity: true } });
  if (batches.some((batch) => !batch.remaining.equals(batch.quantity))) throw new ConflictException(refusal);
  return ids;
}
