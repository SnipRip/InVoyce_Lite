-- Credit notes against invoices and debit notes against goods bills (client, 12 Nov 2026).
-- CreateEnum
CREATE TYPE "NoteReason" AS ENUM ('GOODS_RETURNED', 'RATE_DIFFERENCE', 'DISCOUNT', 'SHORT_SUPPLY', 'OTHER');

-- AlterTable
ALTER TABLE "StockBatch" ADD COLUMN     "creditNoteLineId" UUID;

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issuedNumberId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "invoiceId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "godownId" UUID,
    "reason" "NoteReason" NOT NULL,
    "regime" "SaleRegime" NOT NULL,
    "taxable" DECIMAL(14,2) NOT NULL,
    "cgst" DECIMAL(14,2) NOT NULL,
    "sgst" DECIMAL(14,2) NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "roundOff" DECIMAL(6,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" UUID NOT NULL,
    "creditNoteId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "invoiceLineId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(14,2) NOT NULL,
    "gstRatePct" DECIMAL(5,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNote" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issuedNumberId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "billId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "reason" "NoteReason" NOT NULL,
    "taxable" DECIMAL(14,2) NOT NULL,
    "cgst" DECIMAL(14,2) NOT NULL,
    "sgst" DECIMAL(14,2) NOT NULL,
    "igst" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "itcReversed" DECIMAL(14,2) NOT NULL,
    "roundOff" DECIMAL(6,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNoteLine" (
    "id" UUID NOT NULL,
    "debitNoteId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "billLineId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(14,2) NOT NULL,
    "gstRatePct" DECIMAL(5,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "itcEligible" BOOLEAN NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "batchId" UUID,

    CONSTRAINT "DebitNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_issuedNumberId_key" ON "CreditNote"("issuedNumberId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_partyId_date_idx" ON "CreditNote"("partyId", "date");

-- CreateIndex
CREATE INDEX "CreditNote_date_idx" ON "CreditNote"("date");

-- CreateIndex
CREATE INDEX "CreditNote_number_idx" ON "CreditNote"("number");

-- CreateIndex
CREATE INDEX "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditNoteLine_invoiceLineId_idx" ON "CreditNoteLine"("invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_issuedNumberId_key" ON "DebitNote"("issuedNumberId");

-- CreateIndex
CREATE INDEX "DebitNote_billId_idx" ON "DebitNote"("billId");

-- CreateIndex
CREATE INDEX "DebitNote_partyId_date_idx" ON "DebitNote"("partyId", "date");

-- CreateIndex
CREATE INDEX "DebitNote_date_idx" ON "DebitNote"("date");

-- CreateIndex
CREATE INDEX "DebitNote_number_idx" ON "DebitNote"("number");

-- CreateIndex
CREATE INDEX "DebitNoteLine_debitNoteId_idx" ON "DebitNoteLine"("debitNoteId");

-- CreateIndex
CREATE INDEX "DebitNoteLine_billLineId_idx" ON "DebitNoteLine"("billLineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBatch_creditNoteLineId_key" ON "StockBatch"("creditNoteLineId");

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_creditNoteLineId_fkey" FOREIGN KEY ("creditNoteLineId") REFERENCES "CreditNoteLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_billLineId_fkey" FOREIGN KEY ("billLineId") REFERENCES "PurchaseBillLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Amounts never below zero; a note always reduces something.
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_amounts" CHECK ("taxable" >= 0 AND "tax" >= 0 AND "total" > 0 AND "cost" >= 0);
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_amounts" CHECK ("taxable" >= 0 AND "tax" >= 0 AND "itcReversed" >= 0 AND "itcReversed" <= "tax" AND "total" > 0 AND "cost" >= 0);
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_amounts" CHECK ("quantity" >= 0 AND "taxable" >= 0 AND "tax" >= 0 AND "cost" >= 0);
ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_amounts" CHECK ("quantity" >= 0 AND "taxable" >= 0 AND "tax" >= 0 AND "cost" >= 0 AND (("quantity" = 0) = ("batchId" IS NULL)));
