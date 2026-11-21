-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "partyId" UUID,
ADD COLUMN     "partySide" "BalanceSide";

-- AlterTable
ALTER TABLE "NoteAllocation" ADD COLUMN     "journalChargeId" UUID,
ADD COLUMN     "journalLineId" UUID;

-- AlterTable
ALTER TABLE "SettlementAllocation" ADD COLUMN     "journalLineId" UUID;

-- CreateIndex
CREATE INDEX "JournalLine_partyId_idx" ON "JournalLine"("partyId");

-- CreateIndex
CREATE INDEX "NoteAllocation_journalLineId_idx" ON "NoteAllocation"("journalLineId");

-- CreateIndex
CREATE INDEX "NoteAllocation_journalChargeId_idx" ON "NoteAllocation"("journalChargeId");

-- CreateIndex
CREATE INDEX "SettlementAllocation_journalLineId_idx" ON "SettlementAllocation"("journalLineId");

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "JournalLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAllocation" ADD CONSTRAINT "NoteAllocation_journalChargeId_fkey" FOREIGN KEY ("journalChargeId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A journal line is on exactly one ledger, now possibly a party's; a party line says which side it works on.
ALTER TABLE "JournalLine" DROP CONSTRAINT "JournalLine_one_ledger";
ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_one_ledger" CHECK (num_nonnulls("ledgerId", "headId", "accountId", "partyId") = 1),
  ADD CONSTRAINT "JournalLine_party_side" CHECK (("partyId" IS NULL) = ("partySide" IS NULL));

-- A credit allocation comes from one note or one settling journal line, and
-- goes to one document (now also a journal line that charged the party).
ALTER TABLE "NoteAllocation" DROP CONSTRAINT "NoteAllocation_note_check";
ALTER TABLE "NoteAllocation" DROP CONSTRAINT "NoteAllocation_target_check";
ALTER TABLE "NoteAllocation"
  ADD CONSTRAINT "NoteAllocation_note_check" CHECK (num_nonnulls("creditNoteId", "debitNoteId", "journalLineId") = 1),
  ADD CONSTRAINT "NoteAllocation_target_check" CHECK (num_nonnulls("invoiceId", "billId", "expenseId", "openingPartyId", "journalChargeId") = 1),
  ADD CONSTRAINT "NoteAllocation_not_itself" CHECK ("journalLineId" IS NULL OR "journalChargeId" IS NULL OR "journalLineId" <> "journalChargeId");

-- A settlement allocation still points at exactly one thing, now also a journal charge.
ALTER TABLE "SettlementAllocation" DROP CONSTRAINT "SettlementAllocation_target_check";
ALTER TABLE "SettlementAllocation"
  ADD CONSTRAINT "SettlementAllocation_target_check" CHECK (num_nonnulls("invoiceId", "billId", "openingPartyId", "expenseId", "advanceId", "creditNoteId", "debitNoteId", "journalLineId") = 1);
