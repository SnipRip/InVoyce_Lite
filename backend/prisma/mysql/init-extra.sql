-- What the PostgreSQL migrations add beside the Prisma schema, for MySQL.
--
-- PostgreSQL has partial unique indexes; MySQL and MariaDB do not. Each one
-- here is a generated column that holds the key only on the rows the
-- PostgreSQL index covers (NULL elsewhere: NULLs never clash), with a
-- unique index on it. The columns are not in the Prisma schema; Prisma never
-- writes them.
--
-- The CHECK constraints of the PostgreSQL migrations are not repeated: the
-- services check every one of them before saving.

-- At most one default bank account.
ALTER TABLE `BankCashAccount`
  ADD COLUMN `oneDefaultKey` TINYINT AS (IF(`isDefault`, 1, NULL)) VIRTUAL,
  ADD UNIQUE INDEX `BankCashAccount_one_default` (`oneDefaultKey`);

-- An IRN or an e-way bill number belongs to one invoice only.
ALTER TABLE `InvoiceDocument`
  ADD COLUMN `oneInvoiceKey` VARCHAR(191) AS (IF(`kind` IN ('E_INVOICE', 'EWAY_BILL'), `number`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX `InvoiceDocument_one_invoice_key` (`kind`, `oneInvoiceKey`);
