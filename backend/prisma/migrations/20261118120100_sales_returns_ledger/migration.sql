-- The Sales Returns ledger credit notes with GST debit, under Sales Accounts,
-- so gross sales stay as invoiced and returns show on their own. A ledger of
-- the same name made by hand is left alone (then it takes the postings by
-- name until the role is set on it).
INSERT INTO "Ledger" ("id", "name", "groupId", "systemRole", "notes", "updatedAt")
SELECT gen_random_uuid(), 'Sales Returns', g."id", 'SALES_RETURNS'::"LedgerRole", 'Goods returned and price reductions on credit notes with GST', now()
FROM "LedgerGroup" g
WHERE g."name" = 'Sales Accounts' AND g."parentId" IS NULL
ON CONFLICT ("name") DO NOTHING;
