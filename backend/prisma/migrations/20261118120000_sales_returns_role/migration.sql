-- AlterEnum
-- Credit notes with GST post to Sales Returns (client, 13 Nov 2026). The
-- ledger is seeded in the next migration: a new enum value cannot be used in
-- the transaction that adds it.
ALTER TYPE "LedgerRole" ADD VALUE 'SALES_RETURNS';
