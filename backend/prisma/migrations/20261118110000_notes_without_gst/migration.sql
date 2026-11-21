-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerRole" ADD VALUE 'DISCOUNT_ALLOWED';
ALTER TYPE "LedgerRole" ADD VALUE 'DISCOUNT_RECEIVED';

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "gstAdjusted" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "DebitNote" ADD COLUMN     "gstAdjusted" BOOLEAN NOT NULL DEFAULT true;


-- A note without GST carries no tax and is never for goods coming back (a return always reverses GST).
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_without_gst" CHECK ("gstAdjusted" OR ("tax" = 0 AND "reason" <> 'GOODS_RETURNED'));
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_without_gst" CHECK ("gstAdjusted" OR ("tax" = 0 AND "reason" <> 'GOODS_RETURNED'));
