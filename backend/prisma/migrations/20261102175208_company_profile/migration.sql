-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "stateCode" TEXT NOT NULL,
    "iec" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "district" TEXT,
    "pin" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "exportBank" TEXT,
    "customsStation" TEXT,
    "portCode" TEXT,
    "defaultExportRoute" "ExportRoute" NOT NULL DEFAULT 'LUT',
    "exportCurrency" "PartyCurrency" NOT NULL DEFAULT 'INR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- One row only.
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_single_row" CHECK ("id" = 1);

-- One placeholder row; the administrator fills in the business on the
-- Company profile screen.
INSERT INTO "CompanyProfile" ("id", "legalName", "stateCode", "addressLine", "city", "district", "pin", "phone", "altPhone", "email", "customsStation", "portCode", "updatedAt")
VALUES (1, 'My Company', '19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP);
