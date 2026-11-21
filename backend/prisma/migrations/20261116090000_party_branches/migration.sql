-- CreateEnum
CREATE TYPE "MsmeCategory" AS ENUM ('MICRO', 'SMALL', 'MEDIUM');

-- CreateEnum
CREATE TYPE "MsmeActivity" AS ENUM ('MANUFACTURING', 'SERVICES', 'TRADING');

-- CreateEnum
CREATE TYPE "PartyBranchKind" AS ENUM ('BRANCH', 'SHIP_TO');

-- CreateEnum
CREATE TYPE "PartyLicenceKind" AS ENUM ('FSSAI', 'DRUG', 'TRADE', 'SHOP_ESTABLISHMENT', 'IEC', 'OTHER');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billToBranchId" UUID,
ADD COLUMN     "shipToBranchId" UUID;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "msmeActivity" "MsmeActivity",
ADD COLUMN     "msmeCategory" "MsmeCategory";

-- AlterTable
ALTER TABLE "PurchaseBill" ADD COLUMN     "vendorBranchId" UUID;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "billToBranchId" UUID;

-- CreateTable
CREATE TABLE "PartyBranch" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "kind" "PartyBranchKind" NOT NULL DEFAULT 'BRANCH',
    "name" TEXT NOT NULL,
    "treatment" "GstTreatment",
    "gstin" TEXT,
    "placeOfSupply" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "pin" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyContact" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "branchId" UUID,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyLicence" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "branchId" UUID,
    "kind" "PartyLicenceKind" NOT NULL,
    "label" TEXT,
    "number" TEXT NOT NULL,
    "validUntil" DATE,

    CONSTRAINT "PartyLicence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyBranch_partyId_idx" ON "PartyBranch"("partyId");

-- CreateIndex
CREATE INDEX "PartyBranch_gstin_idx" ON "PartyBranch"("gstin");

-- CreateIndex
CREATE INDEX "PartyContact_partyId_idx" ON "PartyContact"("partyId");

-- CreateIndex
CREATE INDEX "PartyLicence_partyId_idx" ON "PartyLicence"("partyId");

-- AddForeignKey
ALTER TABLE "PartyBranch" ADD CONSTRAINT "PartyBranch_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyContact" ADD CONSTRAINT "PartyContact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyContact" ADD CONSTRAINT "PartyContact_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "PartyBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLicence" ADD CONSTRAINT "PartyLicence_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLicence" ADD CONSTRAINT "PartyLicence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "PartyBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_vendorBranchId_fkey" FOREIGN KEY ("vendorBranchId") REFERENCES "PartyBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_billToBranchId_fkey" FOREIGN KEY ("billToBranchId") REFERENCES "PartyBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billToBranchId_fkey" FOREIGN KEY ("billToBranchId") REFERENCES "PartyBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shipToBranchId_fkey" FOREIGN KEY ("shipToBranchId") REFERENCES "PartyBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
