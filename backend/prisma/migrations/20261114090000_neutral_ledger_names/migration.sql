-- Neutral column names: the app speaks of ledgers and voucher types only.
ALTER TABLE "NumberSeries" RENAME COLUMN "tallyVoucherType" TO "voucherType";
ALTER TABLE "BankCashAccount" RENAME COLUMN "tallyLedgerName" TO "ledgerName";
ALTER INDEX "BankCashAccount_tallyLedgerName_key" RENAME TO "BankCashAccount_ledgerName_key";
