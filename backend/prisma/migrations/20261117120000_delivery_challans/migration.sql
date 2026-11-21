-- Delivery challans (CGST rule 55; client, 12 Nov 2026).
-- CreateEnum
CREATE TYPE "DeliveryChallanStatus" AS ENUM ('OPEN', 'INVOICED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NumberedKind" ADD VALUE 'DELIVERY_CHALLAN';

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issuedNumberId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "partyId" UUID NOT NULL,
    "godownId" UUID NOT NULL,
    "quotationId" UUID,
    "status" "DeliveryChallanStatus" NOT NULL DEFAULT 'OPEN',
    "invoiceId" UUID,
    "shipToLine" TEXT,
    "shipToCity" TEXT,
    "vehicleNumber" TEXT,
    "notes" TEXT,
    "value" DECIMAL(14,2) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanLine" (
    "id" UUID NOT NULL,
    "challanId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "DeliveryChallanLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_issuedNumberId_key" ON "DeliveryChallan"("issuedNumberId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_partyId_date_idx" ON "DeliveryChallan"("partyId", "date");

-- CreateIndex
CREATE INDEX "DeliveryChallan_status_idx" ON "DeliveryChallan"("status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_invoiceId_idx" ON "DeliveryChallan"("invoiceId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_quotationId_idx" ON "DeliveryChallan"("quotationId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_number_idx" ON "DeliveryChallan"("number");

-- CreateIndex
CREATE INDEX "DeliveryChallanLine_challanId_idx" ON "DeliveryChallanLine"("challanId");

-- CreateIndex
CREATE INDEX "DeliveryChallanLine_itemId_idx" ON "DeliveryChallanLine"("itemId");

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A challan line always sends something; an invoiced challan names its invoice.
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_quantity" CHECK ("quantity" > 0 AND "rate" >= 0);
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_invoiced" CHECK (("status" = 'INVOICED') = ("invoiceId" IS NOT NULL));
