-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "enforceHsnGstRate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "gstApplicable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PurchaseBill" ADD COLUMN     "gstApplicable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "gstApplicable" BOOLEAN NOT NULL DEFAULT true;
