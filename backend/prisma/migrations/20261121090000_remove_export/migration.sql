-- Remove export: InVoyce Lite is domestic billing and payments only.
-- Drops export invoices, shipments, the LUT register, overseas and SEZ
-- parties, imports, BTN, customs papers and BRC on receipts, with the
-- system ledgers, number series and expense heads that served them.

-- Refuse to run over real export records rather than lose them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Invoice" WHERE "kind" = 'EXPORT' OR "regime" IN ('EXPORT_LUT', 'EXPORT_IGST')) THEN
    RAISE EXCEPTION 'Export invoices exist: remove them before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "Quotation" WHERE "regime" IN ('EXPORT_LUT', 'EXPORT_IGST'))
     OR EXISTS (SELECT 1 FROM "CreditNote" WHERE "regime" IN ('EXPORT_LUT', 'EXPORT_IGST')) THEN
    RAISE EXCEPTION 'Export quotations or credit notes exist: remove them before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "Party" WHERE "treatment" IN ('OVERSEAS', 'SEZ'))
     OR EXISTS (SELECT 1 FROM "PartyBranch" WHERE "treatment" IN ('OVERSEAS', 'SEZ')) THEN
    RAISE EXCEPTION 'Overseas or SEZ parties exist: change or remove them before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "PurchaseBill" WHERE "regime" = 'IMPORT') THEN
    RAISE EXCEPTION 'Import purchase bills exist: remove them before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "Shipment") THEN
    RAISE EXCEPTION 'Shipments exist: remove them before this migration';
  END IF;
END $$;

-- Role permissions: the Shipments screen is gone, GST & export setup is now Company & GST.
UPDATE "AccessRole"
SET "permissions" = ("permissions"::jsonb - '/shipments' - '/masters/tax-export')
  || CASE WHEN "permissions"::jsonb ? '/masters/tax-export'
       THEN jsonb_build_object('/masters/company', "permissions"::jsonb -> '/masters/tax-export')
       ELSE '{}'::jsonb END;

-- Checks that name export values or columns.
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_kind_check";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_lut_check";
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_brc_check";
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_brc_receipt_check";
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_allocation_check";
-- Checks and a partial index that compare a changed enum column with a
-- literal: they hold the old type, so they come off for the swap and go back on.
ALTER TABLE "AccountHead" DROP CONSTRAINT "AccountHead_indirect_overhead";
ALTER TABLE "Ledger" DROP CONSTRAINT "Ledger_primary";
ALTER TABLE "InvoiceDocument" DROP CONSTRAINT "InvoiceDocument_irn_check";
ALTER TABLE "InvoiceDocument" DROP CONSTRAINT "InvoiceDocument_eway_check";
DROP INDEX "InvoiceDocument_one_invoice_key";

-- Rows that hold export values.
DELETE FROM "PartyLicence" WHERE "kind" = 'IEC';
DELETE FROM "InvoiceDocument" WHERE "kind" IN ('CUSTOMS_INVOICE', 'PACKING_LIST', 'SHIPPING_BILL', 'LEO', 'BRC');
DELETE FROM "Scheme" WHERE "partyScope" = 'OVERSEAS';
-- With every customer in India, "customers in India" is everyone.
UPDATE "Scheme" SET "partyScope" = 'ALL' WHERE "partyScope" = 'INDIA';
UPDATE "Expense" SET "allocation" = 'OVERHEAD', "shipmentId" = NULL WHERE "allocation" = 'SHIPMENT';
UPDATE "AccountHead" SET "allocation" = 'INVOICE' WHERE "allocation" = 'SHIPMENT' AND "name" = 'Freight Outward';
UPDATE "AccountHead" SET "allocation" = 'OVERHEAD' WHERE "allocation" = 'SHIPMENT';
DELETE FROM "AccountHead" h
WHERE h."name" IN ('Customs Agent (CHA) Fees', 'Border and LCS Charges')
  AND NOT EXISTS (SELECT 1 FROM "Expense" e WHERE e."headId" = h."id")
  AND NOT EXISTS (SELECT 1 FROM "PurchaseBillCharge" c WHERE c."headId" = h."id")
  AND NOT EXISTS (SELECT 1 FROM "JournalLine" j WHERE j."headId" = h."id")
  AND NOT EXISTS (SELECT 1 FROM "Loan" l WHERE l."interestHeadId" = h."id");
UPDATE "Ledger" SET "systemRole" = NULL WHERE "systemRole" IN ('SALES_EXPORT_LUT', 'SALES_EXPORT_IGST', 'IGST_REFUND');
DELETE FROM "Ledger" l
WHERE l."name" IN ('Export Sales - LUT', 'Export Sales - IGST', 'IGST Refund Receivable')
  AND NOT EXISTS (SELECT 1 FROM "JournalLine" j WHERE j."ledgerId" = l."id")
  AND NOT EXISTS (SELECT 1 FROM "Loan" n WHERE n."assetLedgerId" = l."id" OR n."tdsLedgerId" = l."id");
DELETE FROM "IssuedNumber" WHERE "kind" IN ('EXPORT_INVOICE', 'SHIPMENT');
DELETE FROM "NumberCounter" c USING "NumberFormat" f, "NumberSeries" s
WHERE c."formatId" = f."id" AND f."seriesId" = s."id" AND s."kind" IN ('EXPORT_INVOICE', 'SHIPMENT');
DELETE FROM "NumberSeries" WHERE "kind" IN ('EXPORT_INVOICE', 'SHIPMENT');


-- AlterEnum
BEGIN;
CREATE TYPE "GstTreatment_new" AS ENUM ('REGISTERED', 'COMPOSITION', 'UNREGISTERED', 'CONSUMER');
ALTER TABLE "Party" ALTER COLUMN "treatment" TYPE "GstTreatment_new" USING ("treatment"::text::"GstTreatment_new");
ALTER TABLE "PartyBranch" ALTER COLUMN "treatment" TYPE "GstTreatment_new" USING ("treatment"::text::"GstTreatment_new");
ALTER TYPE "GstTreatment" RENAME TO "GstTreatment_old";
ALTER TYPE "GstTreatment_new" RENAME TO "GstTreatment";
DROP TYPE "GstTreatment_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PartyLicenceKind_new" AS ENUM ('FSSAI', 'DRUG', 'TRADE', 'SHOP_ESTABLISHMENT', 'OTHER');
ALTER TABLE "PartyLicence" ALTER COLUMN "kind" TYPE "PartyLicenceKind_new" USING ("kind"::text::"PartyLicenceKind_new");
ALTER TYPE "PartyLicenceKind" RENAME TO "PartyLicenceKind_old";
ALTER TYPE "PartyLicenceKind_new" RENAME TO "PartyLicenceKind";
DROP TYPE "PartyLicenceKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "NumberedKind_new" AS ENUM ('QUOTATION', 'SALES_INVOICE', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'JOURNAL', 'STOCK_JOURNAL', 'EXPENSE', 'CUSTOMER_CODE', 'VENDOR_CODE', 'ITEM_SKU', 'PURCHASE_ORDER', 'STOCK_TRANSFER', 'DELIVERY_CHALLAN');
ALTER TABLE "NumberSeries" ALTER COLUMN "kind" TYPE "NumberedKind_new" USING ("kind"::text::"NumberedKind_new");
ALTER TABLE "IssuedNumber" ALTER COLUMN "kind" TYPE "NumberedKind_new" USING ("kind"::text::"NumberedKind_new");
ALTER TYPE "NumberedKind" RENAME TO "NumberedKind_old";
ALTER TYPE "NumberedKind_new" RENAME TO "NumberedKind";
DROP TYPE "NumberedKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "HeadAllocation_new" AS ENUM ('ITEM_COST', 'INVOICE', 'OVERHEAD');
ALTER TABLE "AccountHead" ALTER COLUMN "allocation" TYPE "HeadAllocation_new" USING ("allocation"::text::"HeadAllocation_new");
ALTER TABLE "Expense" ALTER COLUMN "allocation" TYPE "HeadAllocation_new" USING ("allocation"::text::"HeadAllocation_new");
ALTER TYPE "HeadAllocation" RENAME TO "HeadAllocation_old";
ALTER TYPE "HeadAllocation_new" RENAME TO "HeadAllocation";
DROP TYPE "HeadAllocation_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LedgerRole_new" AS ENUM ('PROFIT_AND_LOSS', 'CAPITAL', 'DRAWINGS', 'SALES_LOCAL', 'SALES_INTERSTATE', 'PURCHASE_LOCAL', 'PURCHASE_INTERSTATE', 'PURCHASE_NO_ITC', 'OUTPUT_CGST', 'OUTPUT_SGST', 'OUTPUT_IGST', 'INPUT_CGST', 'INPUT_SGST', 'INPUT_IGST', 'RCM_CGST', 'RCM_SGST', 'RCM_IGST', 'TDS_PAYABLE', 'TDS_RECEIVABLE', 'ROUND_OFF', 'STOCK_WRITE_OFF', 'STOCK_FOUND', 'STOCK_ADJUSTMENT', 'TDS_PAYABLE_VENDOR', 'DISCOUNT_ALLOWED', 'DISCOUNT_RECEIVED', 'SALES_RETURNS');
ALTER TABLE "Ledger" ALTER COLUMN "systemRole" TYPE "LedgerRole_new" USING ("systemRole"::text::"LedgerRole_new");
ALTER TYPE "LedgerRole" RENAME TO "LedgerRole_old";
ALTER TYPE "LedgerRole_new" RENAME TO "LedgerRole";
DROP TYPE "LedgerRole_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SchemePartyScope_new" AS ENUM ('ALL', 'SELECTED');
ALTER TABLE "Scheme" ALTER COLUMN "partyScope" DROP DEFAULT;
ALTER TABLE "Scheme" ALTER COLUMN "partyScope" TYPE "SchemePartyScope_new" USING ("partyScope"::text::"SchemePartyScope_new");
ALTER TYPE "SchemePartyScope" RENAME TO "SchemePartyScope_old";
ALTER TYPE "SchemePartyScope_new" RENAME TO "SchemePartyScope";
DROP TYPE "SchemePartyScope_old";
ALTER TABLE "Scheme" ALTER COLUMN "partyScope" SET DEFAULT 'ALL';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseRegime_new" AS ENUM ('INTRA_STATE', 'INTER_STATE', 'NO_GST', 'REVERSE_CHARGE');
ALTER TABLE "PurchaseBill" ALTER COLUMN "regime" TYPE "PurchaseRegime_new" USING ("regime"::text::"PurchaseRegime_new");
ALTER TYPE "PurchaseRegime" RENAME TO "PurchaseRegime_old";
ALTER TYPE "PurchaseRegime_new" RENAME TO "PurchaseRegime";
DROP TYPE "PurchaseRegime_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SaleRegime_new" AS ENUM ('INTRA_STATE', 'INTER_STATE', 'BILL_OF_SUPPLY');
ALTER TABLE "Quotation" ALTER COLUMN "regime" TYPE "SaleRegime_new" USING ("regime"::text::"SaleRegime_new");
ALTER TABLE "Invoice" ALTER COLUMN "regime" TYPE "SaleRegime_new" USING ("regime"::text::"SaleRegime_new");
ALTER TABLE "CreditNote" ALTER COLUMN "regime" TYPE "SaleRegime_new" USING ("regime"::text::"SaleRegime_new");
ALTER TYPE "SaleRegime" RENAME TO "SaleRegime_old";
ALTER TYPE "SaleRegime_new" RENAME TO "SaleRegime";
DROP TYPE "SaleRegime_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "DispatchDocumentKind_new" AS ENUM ('E_INVOICE', 'LORRY_CHALLAN', 'EWAY_BILL');
ALTER TABLE "InvoiceDocument" ALTER COLUMN "kind" TYPE "DispatchDocumentKind_new" USING ("kind"::text::"DispatchDocumentKind_new");
ALTER TYPE "DispatchDocumentKind" RENAME TO "DispatchDocumentKind_old";
ALTER TYPE "DispatchDocumentKind_new" RENAME TO "DispatchDocumentKind";
DROP TYPE "DispatchDocumentKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_partyId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_transporterId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentInvoice" DROP CONSTRAINT "ShipmentInvoice_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentInvoice" DROP CONSTRAINT "ShipmentInvoice_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentEvent" DROP CONSTRAINT "ShipmentEvent_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentEvent" DROP CONSTRAINT "ShipmentEvent_byId_fkey";

-- DropIndex
DROP INDEX "Expense_shipmentId_idx";

-- AlterTable
ALTER TABLE "Party" DROP COLUMN "country",
DROP COLUMN "currency",
DROP COLUMN "exportRoute",
DROP COLUMN "foreignTaxId";

-- AlterTable
ALTER TABLE "CompanyProfile" DROP COLUMN "customsStation",
DROP COLUMN "defaultExportRoute",
DROP COLUMN "exportBank",
DROP COLUMN "exportCurrency",
DROP COLUMN "iec",
DROP COLUMN "portCode";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "currency",
DROP COLUMN "destinationCountry",
DROP COLUMN "kind",
DROP COLUMN "lutArn";

-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "brcDate",
DROP COLUMN "brcNumber";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "shipmentId";

-- DropTable
DROP TABLE "Lut";

-- DropTable
DROP TABLE "Shipment";

-- DropTable
DROP TABLE "ShipmentInvoice";

-- DropTable
DROP TABLE "ShipmentEvent";

-- DropEnum
DROP TYPE "ExportRoute";

-- DropEnum
DROP TYPE "PartyCurrency";

-- DropEnum
DROP TYPE "InvoiceKind";

-- DropEnum
DROP TYPE "ShipmentStage";


-- Checks again, without export.
ALTER TABLE "AccountHead" ADD CONSTRAINT "AccountHead_indirect_overhead" CHECK ("nature" <> 'INDIRECT_EXPENSE' OR "allocation" = 'OVERHEAD');
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_primary" CHECK (("groupId" IS NULL) = ("systemRole" IS NOT DISTINCT FROM 'PROFIT_AND_LOSS'));
ALTER TABLE "InvoiceDocument"
  ADD CONSTRAINT "InvoiceDocument_irn_check" CHECK ("kind" <> 'E_INVOICE' OR "number" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "InvoiceDocument_eway_check" CHECK ("kind" <> 'EWAY_BILL' OR "number" ~ '^[0-9]{12}$');
CREATE UNIQUE INDEX "InvoiceDocument_one_invoice_key" ON "InvoiceDocument" ("kind", "number") WHERE "kind" IN ('E_INVOICE', 'EWAY_BILL');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_place_check" CHECK ("placeOfSupply" IS NOT NULL);
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_allocation_check" CHECK (
    ("allocation" = 'ITEM_COST' AND "billId" IS NOT NULL AND "invoiceId" IS NULL)
    OR ("allocation" = 'INVOICE' AND "invoiceId" IS NOT NULL AND "billId" IS NULL)
    OR ("allocation" = 'OVERHEAD' AND "billId" IS NULL AND "invoiceId" IS NULL));
