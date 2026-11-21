-- Journal vouchers (client, 12 Nov 2026): ledgers debited and credited by hand.
-- CreateTable
CREATE TABLE "JournalVoucher" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issuedNumberId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "narration" TEXT,
    "total" DECIMAL(14,2) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "ledgerId" UUID,
    "headId" UUID,
    "accountId" UUID,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalVoucher_issuedNumberId_key" ON "JournalVoucher"("issuedNumberId");

-- CreateIndex
CREATE INDEX "JournalVoucher_date_idx" ON "JournalVoucher"("date");

-- CreateIndex
CREATE INDEX "JournalVoucher_number_idx" ON "JournalVoucher"("number");

-- CreateIndex
CREATE INDEX "JournalLine_journalId_idx" ON "JournalLine"("journalId");

-- CreateIndex
CREATE INDEX "JournalLine_ledgerId_idx" ON "JournalLine"("ledgerId");

-- CreateIndex
CREATE INDEX "JournalLine_headId_idx" ON "JournalLine"("headId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- AddForeignKey
ALTER TABLE "JournalVoucher" ADD CONSTRAINT "JournalVoucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_headId_fkey" FOREIGN KEY ("headId") REFERENCES "AccountHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankCashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One ledger per line, one side per line, nothing negative.
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_one_ledger" CHECK (num_nonnulls("ledgerId", "headId", "accountId") = 1);
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_one_side" CHECK ("debit" >= 0 AND "credit" >= 0 AND (("debit" > 0) <> ("credit" > 0)));
ALTER TABLE "JournalVoucher" ADD CONSTRAINT "JournalVoucher_total_positive" CHECK ("total" > 0);
