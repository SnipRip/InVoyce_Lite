// The few statements Prisma cannot express, written once for each database
// InVoyce Lite runs on: PostgreSQL, or MySQL / MariaDB. DATABASE_URL decides
// which (postgresql://… or mysql://…), the same way prisma7.config.ts picks
// the schema the client was generated from.
//
// Services lock rows here before they read them with Prisma, inside their
// transaction. Both databases run transactions at READ COMMITTED (see
// prisma.service.ts), so a read after the lock sees the latest saved row.
import { Prisma } from '../generated/prisma/client.js';

export type Dialect = 'postgresql' | 'mysql';

/** postgresql://… or postgres://… → PostgreSQL; mysql://… or mariadb://… → MySQL / MariaDB. */
export function dialectOf(url: string | undefined): Dialect {
  return /^(mysql|mariadb):/i.test(url?.trim() ?? '') ? 'mysql' : 'postgresql';
}

export const dialect = (): Dialect => dialectOf(process.env['DATABASE_URL']);
export const isMysql = () => dialect() === 'mysql';

type Tx = Prisma.TransactionClient;

/** Tables locked by id. Names are fixed here, never taken from a request. */
export type LockTable =
  | 'AccountHead'
  | 'CreditNote'
  | 'DebitNote'
  | 'DeliveryChallan'
  | 'Expense'
  | 'Godown'
  | 'Invoice'
  | 'InvoiceDocument'
  | 'Item'
  | 'JournalLine'
  | 'JournalVoucher'
  | 'Ledger'
  | 'Loan'
  | 'NumberSeries'
  | 'Party'
  | 'PartyBranch'
  | 'PurchaseBill'
  | 'PurchaseOrder'
  | 'Quotation'
  | 'Settlement'
  | 'StockAdjustment'
  | 'StockBatch'
  | 'StockTransfer'
  | 'Vehicle';

export type LockMode = 'update' | 'share';

const name = (identifier: string) => Prisma.raw(isMysql() ? `\`${identifier}\`` : `"${identifier}"`);
const uuid = (value: string) => (isMysql() ? Prisma.sql`${value}` : Prisma.sql`${value}::uuid`);
const lockClause = (mode: LockMode) =>
  Prisma.raw(mode === 'update' ? 'FOR UPDATE' : isMysql() ? 'LOCK IN SHARE MODE' : 'FOR SHARE');

/**
 * Locks rows by id, in id order so two transactions never deadlock on the
 * same set. `share` lets other readers lock too and only blocks writers.
 * Returns how many rows exist (0 = none of them).
 */
export async function lockRows(tx: Tx, table: LockTable, ids: string | readonly string[], mode: LockMode = 'update'): Promise<number> {
  const list = [...new Set(typeof ids === 'string' ? [ids] : ids)];
  if (list.length === 0) return 0;
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM ${name(table)} WHERE ${name('id')} IN (${Prisma.join(list.map(uuid))}) ORDER BY ${name('id')} ${lockClause(mode)}`;
  return rows.length;
}

/** Locks every row of one item in one godown (its opening stock, or its batches). */
export async function lockItemInGodown(tx: Tx, table: 'ItemOpeningStock' | 'StockBatch', itemId: string, godownId: string): Promise<void> {
  const order = table === 'StockBatch' ? Prisma.sql` ORDER BY ${name('id')}` : Prisma.empty;
  await tx.$queryRaw`
    SELECT 1 FROM ${name(table)} WHERE ${name('itemId')} = ${uuid(itemId)} AND ${name('godownId')} = ${uuid(godownId)}${order} ${lockClause('update')}`;
}

/**
 * Stops anyone else writing the ledger-group tree until this transaction
 * ends. PostgreSQL locks the table; MySQL locks every row of it (the tree
 * always has its primary groups, and every writer comes through here).
 */
export async function lockLedgerGroups(tx: Tx): Promise<void> {
  if (isMysql()) await tx.$queryRaw`SELECT 1 FROM \`LedgerGroup\` ORDER BY \`id\` FOR UPDATE`;
  else await tx.$executeRaw`LOCK TABLE "LedgerGroup" IN SHARE ROW EXCLUSIVE MODE`;
}

/**
 * Case-insensitive text matching for a Prisma string filter. PostgreSQL
 * needs `mode: 'insensitive'`; MySQL compares without case already (the
 * database's utf8mb4 *_ci collation) and has no such option.
 */
export const anyCase = (): { mode?: 'insensitive' } => (isMysql() ? {} : { mode: 'insensitive' });
