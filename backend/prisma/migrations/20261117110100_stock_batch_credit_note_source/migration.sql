-- Goods a customer returned on a credit note come back as their own batch:
-- a batch now has exactly one of four sources.
ALTER TABLE "StockBatch" DROP CONSTRAINT "StockBatch_source_check";
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_source_check"
  CHECK (num_nonnulls("billLineId", "transferLineId", "adjustmentLineId", "creditNoteLineId") = 1);
