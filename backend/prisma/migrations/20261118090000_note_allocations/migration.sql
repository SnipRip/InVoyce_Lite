-- AlterTable
ALTER TABLE "SettlementAllocation" ADD COLUMN     "creditNoteId" UUID,
ADD COLUMN     "debitNoteId" UUID;

-- CreateTable
CREATE TABLE "NoteAllocation" (
    "id" UUID NOT NULL,
    "creditNoteId" UUID,
    "debitNoteId" UUID,
    "invoiceId" UUID,
    "billId" UUID,
    "expenseId" UUID,
    "openingPartyId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteAllocation_creditNoteId_idx" ON "NoteAllocation"("creditNoteId");

-- CreateIndex
CREATE INDEX "NoteAllocation_debitNoteId_idx" ON "NoteAllocation"("debitNoteId");

-- CreateIndex
CREATE INDEX "NoteAllocation_invoiceId_idx" ON "NoteAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "NoteAllocation_billId_idx" ON "NoteAllocation"("billId");

-- CreateIndex
CREATE INDEX "NoteAllocation_expenseId_idx" ON "NoteAllocation"("expenseId");

-- CreateIndex
CREATE INDEX "NoteAllocation_openingPartyId_idx" ON "NoteAllocation"("openingPartyId");

-- CreateIndex
CREATE INDEX "SettlementAllocation_creditNoteId_idx" ON "SettlementAllocation"("creditNoteId");

-- CreateIndex
CREATE INDEX "SettlementAllocation_debitNoteId_idx" ON "SettlementAllocation"("debitNoteId");

-- AddForeignKey
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_openingPartyId_fkey" FOREIGN KEY ("openingPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A settlement allocation still points at exactly one thing, now also a note's credit (a refund of it).
ALTER TABLE "SettlementAllocation" DROP CONSTRAINT "SettlementAllocation_target_check";
ALTER TABLE "SettlementAllocation"
  ADD CONSTRAINT "SettlementAllocation_target_check" CHECK (num_nonnulls("invoiceId", "billId", "openingPartyId", "expenseId", "advanceId", "creditNoteId", "debitNoteId") = 1);

-- A note allocation: from exactly one note, to exactly one document, for more than zero.
ALTER TABLE "NoteAllocation"
  ADD CONSTRAINT "NoteAllocation_note_check" CHECK (num_nonnulls("creditNoteId", "debitNoteId") = 1),
  ADD CONSTRAINT "NoteAllocation_target_check" CHECK (num_nonnulls("invoiceId", "billId", "expenseId", "openingPartyId") = 1),
  ADD CONSTRAINT "NoteAllocation_amount_check" CHECK ("amount" > 0),
  -- A credit note settles what the customer owes (invoices, opening balance); a debit note what we owe the vendor.
  ADD CONSTRAINT "NoteAllocation_side_check" CHECK (
    ("creditNoteId" IS NULL OR ("billId" IS NULL AND "expenseId" IS NULL)) AND
    ("debitNoteId" IS NULL OR "invoiceId" IS NULL)
  );

-- Notes saved before this settled their own document in full (they were never
-- allowed past what was due). A credit note on an export with IGST settles only
-- the goods value: the IGST part was never the customer's to pay.
INSERT INTO "NoteAllocation" ("id", "creditNoteId", "invoiceId", "amount")
SELECT gen_random_uuid(), "id", "invoiceId",
       "total" - CASE WHEN "regime" = 'EXPORT_IGST' THEN "igst" ELSE 0 END
FROM "CreditNote"
WHERE "total" - CASE WHEN "regime" = 'EXPORT_IGST' THEN "igst" ELSE 0 END > 0;

INSERT INTO "NoteAllocation" ("id", "debitNoteId", "billId", "amount")
SELECT gen_random_uuid(), "id", "billId", "total" FROM "DebitNote" WHERE "total" > 0;
