-- Cash is one fixed account; one bank or overdraft account can be the default
-- for receipts and payments (client, 12 Nov 2026).
ALTER TABLE "BankCashAccount" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankCashAccount" ADD CONSTRAINT "BankCashAccount_default_is_bank" CHECK (NOT "isDefault" OR ("kind" <> 'CASH' AND NOT "isArchived"));
CREATE UNIQUE INDEX "BankCashAccount_one_default" ON "BankCashAccount" ("isDefault") WHERE "isDefault";

-- The books always have their cash account.
INSERT INTO "BankCashAccount" ("id", "name", "kind", "openingBalance", "openingDate", "updatedAt")
SELECT gen_random_uuid(), 'Cash', 'CASH', 0, DATE '2026-04-01', now()
WHERE NOT EXISTS (SELECT 1 FROM "BankCashAccount" WHERE "kind" = 'CASH')
  AND NOT EXISTS (SELECT 1 FROM "BankCashAccount" WHERE lower("name") = 'cash' OR lower("ledgerName") = 'cash');
