-- CreateTable
CREATE TABLE `AccessRole` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT (''),
    `permissions` JSON NOT NULL DEFAULT ('{}'),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessRole_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `fullName` TEXT NOT NULL,
    `displayName` TEXT NOT NULL,
    `phone` TEXT NULL,
    `role` ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `accessRoleId` CHAR(36) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `lastSignInAt` DATETIME(3) NULL,
    `passwordHash` TEXT NOT NULL,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_accessRoleId_idx`(`accessRoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NULL,
    `ipAddress` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsappOptIn` (
    `id` CHAR(36) NOT NULL,
    `phoneE164` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `businessName` TEXT NULL,
    `consentText` TEXT NOT NULL,
    `consentVersion` TEXT NOT NULL,
    `source` TEXT NOT NULL,
    `ipAddress` TEXT NULL,
    `userAgent` TEXT NULL,
    `optedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `optedOutAt` DATETIME(3) NULL,

    UNIQUE INDEX `WhatsappOptIn_phoneE164_key`(`phoneE164`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` CHAR(36) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `kind` ENUM('COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA') NOT NULL,
    `decimals` INTEGER NOT NULL DEFAULT 0,
    `uqc` TEXT NOT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Unit_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Brand` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` CHAR(36) NULL,
    `isAuthorised` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Brand_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Godown` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NOT NULL,
    `kind` ENUM('STORE', 'YARD', 'SITE') NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `inCharge` TEXT NULL,
    `phone` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Godown_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemCategory` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parentId` CHAR(36) NULL,
    `hsn` TEXT NULL,
    `gstRatePct` DECIMAL(5, 2) NULL,
    `defaultUnitId` CHAR(36) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ItemCategory_parentId_idx`(`parentId`),
    UNIQUE INDEX `ItemCategory_parentId_name_key`(`parentId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemGroup` (
    `id` CHAR(36) NOT NULL,
    `name` TEXT NOT NULL,
    `skuPrefix` VARCHAR(191) NULL,
    `categoryId` CHAR(36) NOT NULL,
    `subCategoryId` CHAR(36) NULL,
    `brandId` CHAR(36) NULL,
    `description` TEXT NULL,
    `attributes` JSON NOT NULL,
    `hsn` TEXT NULL,
    `gstRatePct` DECIMAL(5, 2) NULL,
    `defaultUnitId` CHAR(36) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ItemGroup_skuPrefix_key`(`skuPrefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Item` (
    `id` CHAR(36) NOT NULL,
    `name` TEXT NOT NULL,
    `sku` VARCHAR(191) NULL,
    `categoryId` CHAR(36) NOT NULL,
    `subCategoryId` CHAR(36) NULL,
    `groupId` CHAR(36) NULL,
    `attributeValues` JSON NULL,
    `brandId` CHAR(36) NULL,
    `description` TEXT NULL,
    `hsn` TEXT NOT NULL,
    `gstRatePct` DECIMAL(5, 2) NULL,
    `unitId` CHAR(36) NULL,
    `reportingUnitId` CHAR(36) NULL,
    `weightKg` DECIMAL(12, 3) NULL,
    `mrp` DECIMAL(12, 2) NULL,
    `preferredSupplier` TEXT NULL,
    `reorderLevel` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Item_sku_key`(`sku`),
    INDEX `Item_categoryId_idx`(`categoryId`),
    INDEX `Item_subCategoryId_idx`(`subCategoryId`),
    INDEX `Item_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemUnitConversion` (
    `id` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `unitId` CHAR(36) NOT NULL,
    `baseQuantity` DECIMAL(14, 4) NOT NULL,

    UNIQUE INDEX `ItemUnitConversion_itemId_unitId_key`(`itemId`, `unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemOpeningStock` (
    `itemId` CHAR(36) NOT NULL,
    `godownId` CHAR(36) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `value` DECIMAL(14, 2) NOT NULL,
    `drawn` DECIMAL(14, 3) NOT NULL DEFAULT 0,

    PRIMARY KEY (`itemId`, `godownId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Party` (
    `id` CHAR(36) NOT NULL,
    `isCustomer` BOOLEAN NOT NULL DEFAULT false,
    `isVendor` BOOLEAN NOT NULL DEFAULT false,
    `kind` ENUM('BUSINESS', 'INDIVIDUAL') NOT NULL DEFAULT 'BUSINESS',
    `displayName` TEXT NOT NULL,
    `legalName` TEXT NULL,
    `contactPerson` TEXT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `treatment` ENUM('REGISTERED', 'COMPOSITION', 'UNREGISTERED', 'CONSUMER') NOT NULL,
    `gstin` VARCHAR(191) NULL,
    `pan` TEXT NULL,
    `placeOfSupply` TEXT NULL,
    `isGta` BOOLEAN NOT NULL DEFAULT false,
    `transin` VARCHAR(191) NULL,
    `addressLine` TEXT NULL,
    `city` TEXT NULL,
    `pin` TEXT NULL,
    `creditDays` INTEGER NOT NULL DEFAULT 0,
    `creditLimit` DECIMAL(14, 2) NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingBalanceSide` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL DEFAULT 'RECEIVABLE',
    `udyamNumber` TEXT NULL,
    `msmeCategory` ENUM('MICRO', 'SMALL', 'MEDIUM') NULL,
    `msmeActivity` ENUM('MANUFACTURING', 'SERVICES', 'TRADING') NULL,
    `bankName` TEXT NULL,
    `bankAccountNumber` TEXT NULL,
    `ifsc` TEXT NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Party_gstin_key`(`gstin`),
    UNIQUE INDEX `Party_transin_key`(`transin`),
    INDEX `Party_isCustomer_idx`(`isCustomer`),
    INDEX `Party_isVendor_idx`(`isVendor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartyBranch` (
    `id` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `kind` ENUM('BRANCH', 'SHIP_TO') NOT NULL DEFAULT 'BRANCH',
    `name` TEXT NOT NULL,
    `treatment` ENUM('REGISTERED', 'COMPOSITION', 'UNREGISTERED', 'CONSUMER') NULL,
    `gstin` VARCHAR(191) NULL,
    `placeOfSupply` TEXT NOT NULL,
    `addressLine` TEXT NULL,
    `city` TEXT NULL,
    `pin` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PartyBranch_partyId_idx`(`partyId`),
    INDEX `PartyBranch_gstin_idx`(`gstin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartyContact` (
    `id` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `name` TEXT NOT NULL,
    `designation` TEXT NULL,
    `phone` TEXT NULL,
    `email` TEXT NULL,
    `whatsapp` BOOLEAN NOT NULL DEFAULT false,

    INDEX `PartyContact_partyId_idx`(`partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartyLicence` (
    `id` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `branchId` CHAR(36) NULL,
    `kind` ENUM('FSSAI', 'DRUG', 'TRADE', 'SHOP_ESTABLISHMENT', 'OTHER') NOT NULL,
    `label` TEXT NULL,
    `number` TEXT NOT NULL,
    `validUntil` DATE NULL,

    INDEX `PartyLicence_partyId_idx`(`partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HsnCode` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `kind` ENUM('HSN', 'SAC') NOT NULL,
    `description` TEXT NOT NULL,
    `cessPct` DECIMAL(5, 2) NULL,
    `reverseCharge` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HsnCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HsnRate` (
    `id` CHAR(36) NOT NULL,
    `hsnCodeId` CHAR(36) NOT NULL,
    `ratePct` DECIMAL(5, 2) NOT NULL,
    `effectiveFrom` DATE NOT NULL,

    UNIQUE INDEX `HsnRate_hsnCodeId_effectiveFrom_key`(`hsnCodeId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SpecialRate` (
    `id` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NULL,
    `categoryId` CHAR(36) NULL,
    `kind` ENUM('NET', 'DISCOUNT') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `validFrom` DATE NOT NULL,
    `validTill` DATE NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SpecialRate_partyId_idx`(`partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemPrice` (
    `id` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `validFrom` DATE NOT NULL,
    `validTill` DATE NOT NULL,
    `sellingPrice` DECIMAL(12, 2) NOT NULL,
    `mrp` DECIMAL(12, 2) NULL,
    `minSellingPrice` DECIMAL(12, 2) NULL,
    `costPrice` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ItemPrice_validFrom_validTill_idx`(`validFrom`, `validTill`),
    UNIQUE INDEX `ItemPrice_itemId_validFrom_validTill_key`(`itemId`, `validFrom`, `validTill`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyProfile` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `legalName` TEXT NOT NULL,
    `tradeName` TEXT NULL,
    `gstin` TEXT NULL,
    `pan` TEXT NULL,
    `registration` ENUM('REGULAR', 'COMPOSITION', 'UNREGISTERED') NOT NULL DEFAULT 'REGULAR',
    `stateCode` TEXT NOT NULL,
    `addressLine` TEXT NULL,
    `city` TEXT NULL,
    `district` TEXT NULL,
    `pin` TEXT NULL,
    `phone` TEXT NULL,
    `altPhone` TEXT NULL,
    `email` TEXT NULL,
    `enforceHsnGstRate` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesSettings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `invoiceInStockOnly` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NumberSeries` (
    `id` CHAR(36) NOT NULL,
    `kind` ENUM('QUOTATION', 'SALES_INVOICE', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'JOURNAL', 'STOCK_JOURNAL', 'EXPENSE', 'CUSTOMER_CODE', 'VENDOR_CODE', 'ITEM_SKU', 'PURCHASE_ORDER', 'STOCK_TRANSFER', 'DELIVERY_CHALLAN') NOT NULL,
    `method` ENUM('AUTOMATIC', 'AUTOMATIC_MANUAL_OVERRIDE', 'MANUAL') NOT NULL DEFAULT 'AUTOMATIC',
    `voucherType` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NumberSeries_kind_key`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NumberFormat` (
    `id` CHAR(36) NOT NULL,
    `seriesId` CHAR(36) NOT NULL,
    `applicableFrom` DATE NOT NULL,
    `pattern` TEXT NOT NULL,
    `startNumber` INTEGER NOT NULL DEFAULT 1,
    `reset` ENUM('YEARLY', 'MONTHLY', 'NEVER') NOT NULL DEFAULT 'YEARLY',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `NumberFormat_seriesId_applicableFrom_key`(`seriesId`, `applicableFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NumberCounter` (
    `formatId` CHAR(36) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `nextNumber` INTEGER NOT NULL,

    PRIMARY KEY (`formatId`, `period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssuedNumber` (
    `id` CHAR(36) NOT NULL,
    `kind` ENUM('QUOTATION', 'SALES_INVOICE', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE', 'JOURNAL', 'STOCK_JOURNAL', 'EXPENSE', 'CUSTOMER_CODE', 'VENDOR_CODE', 'ITEM_SKU', 'PURCHASE_ORDER', 'STOCK_TRANSFER', 'DELIVERY_CHALLAN') NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `uniqueWithin` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `formatId` CHAR(36) NULL,
    `sequence` INTEGER NULL,
    `documentDate` DATE NOT NULL,
    `documentId` CHAR(36) NULL,
    `status` ENUM('ISSUED', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IssuedNumber_kind_uniqueWithin_idx`(`kind`, `uniqueWithin`),
    UNIQUE INDEX `IssuedNumber_scope_uniqueWithin_number_key`(`scope`, `uniqueWithin`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BankCashAccount` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('BANK', 'OVERDRAFT', 'CASH') NOT NULL,
    `bankName` TEXT NULL,
    `branch` TEXT NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifsc` VARCHAR(191) NULL,
    `upiId` TEXT NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingDate` DATE NOT NULL,
    `showOnInvoice` BOOLEAN NOT NULL DEFAULT false,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `ledgerName` VARCHAR(191) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BankCashAccount_name_key`(`name`),
    UNIQUE INDEX `BankCashAccount_ledgerName_key`(`ledgerName`),
    UNIQUE INDEX `BankCashAccount_ifsc_accountNumber_key`(`ifsc`, `accountNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalVoucher` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `narration` TEXT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `JournalVoucher_issuedNumberId_key`(`issuedNumberId`),
    INDEX `JournalVoucher_date_idx`(`date`),
    INDEX `JournalVoucher_number_idx`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalLine` (
    `id` CHAR(36) NOT NULL,
    `journalId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `ledgerId` CHAR(36) NULL,
    `headId` CHAR(36) NULL,
    `accountId` CHAR(36) NULL,
    `partyId` CHAR(36) NULL,
    `partySide` ENUM('RECEIVABLE', 'PAYABLE') NULL,
    `debit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(14, 2) NOT NULL DEFAULT 0,

    INDEX `JournalLine_journalId_idx`(`journalId`),
    INDEX `JournalLine_ledgerId_idx`(`ledgerId`),
    INDEX `JournalLine_headId_idx`(`headId`),
    INDEX `JournalLine_accountId_idx`(`accountId`),
    INDEX `JournalLine_partyId_idx`(`partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Loan` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `direction` ENUM('TAKEN', 'GIVEN') NOT NULL,
    `kind` ENUM('VEHICLE', 'EQUIPMENT', 'PROPERTY', 'BUSINESS', 'GOLD', 'OWNER', 'STAFF', 'DEPOSIT', 'OTHER') NOT NULL,
    `repayment` ENUM('EMI', 'FLEXIBLE') NOT NULL,
    `partyName` TEXT NOT NULL,
    `loanAccountNumber` TEXT NULL,
    `isSecured` BOOLEAN NOT NULL,
    `security` TEXT NULL,
    `principal` DECIMAL(14, 2) NOT NULL,
    `interestRatePct` DECIMAL(5, 2) NOT NULL,
    `disbursedOn` DATE NOT NULL,
    `disbursal` ENUM('BEFORE_BOOKS', 'THROUGH_BANK', 'PAID_TO_SELLER') NOT NULL,
    `disbursalAccountId` CHAR(36) NULL,
    `assetLedgerId` CHAR(36) NULL,
    `paidBefore` INTEGER NOT NULL DEFAULT 0,
    `openingOutstanding` DECIMAL(14, 2) NULL,
    `tenureMonths` INTEGER NULL,
    `emiAmount` DECIMAL(14, 2) NULL,
    `firstEmiDate` DATE NULL,
    `interestFrequency` ENUM('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'AT_MATURITY') NULL,
    `firstInterestDate` DATE NULL,
    `maturityDate` DATE NULL,
    `repaymentAccountId` CHAR(36) NOT NULL,
    `interestHeadId` CHAR(36) NULL,
    `tdsRatePct` DECIMAL(5, 2) NULL,
    `tdsLedgerId` CHAR(36) NULL,
    `reminderDays` INTEGER NOT NULL DEFAULT 3,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Loan_name_key`(`name`),
    INDEX `Loan_interestHeadId_idx`(`interestHeadId`),
    INDEX `Loan_assetLedgerId_idx`(`assetLedgerId`),
    INDEX `Loan_tdsLedgerId_idx`(`tdsLedgerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanEntry` (
    `id` CHAR(36) NOT NULL,
    `loanId` CHAR(36) NOT NULL,
    `kind` ENUM('EMI', 'PRINCIPAL', 'INTEREST', 'INTEREST_ADDED', 'DRAWDOWN') NOT NULL,
    `instalmentNo` INTEGER NULL,
    `entryDate` DATE NOT NULL,
    `principal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `interest` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tds` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `charges` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `bankAccountId` CHAR(36) NULL,
    `reference` TEXT NULL,
    `voucherNumber` TEXT NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LoanEntry_issuedNumberId_key`(`issuedNumberId`),
    INDEX `LoanEntry_loanId_entryDate_idx`(`loanId`, `entryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountHead` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nature` ENUM('DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DIRECT_INCOME', 'INDIRECT_INCOME') NOT NULL,
    `gst` ENUM('FOLLOWS_BILL', 'OWN_RATE', 'NONE') NULL,
    `gstRatePct` DECIMAL(5, 2) NULL,
    `allocation` ENUM('ITEM_COST', 'INVOICE', 'OVERHEAD') NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccountHead_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportJob` (
    `id` CHAR(36) NOT NULL,
    `master` VARCHAR(191) NOT NULL,
    `fileName` TEXT NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `headers` JSON NOT NULL,
    `totalRows` INTEGER NOT NULL,
    `nextRow` INTEGER NOT NULL DEFAULT 0,
    `created` INTEGER NOT NULL DEFAULT 0,
    `updated` INTEGER NOT NULL DEFAULT 0,
    `skipped` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('RUNNING', 'STOPPED', 'DONE') NOT NULL DEFAULT 'RUNNING',
    `error` TEXT NULL,
    `userId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImportJob_master_fingerprint_idx`(`master`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportSkippedRow` (
    `id` CHAR(36) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `cells` JSON NOT NULL,
    `reason` TEXT NOT NULL,

    UNIQUE INDEX `ImportSkippedRow_jobId_rowNumber_key`(`jobId`, `rowNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LedgerGroup` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parentId` CHAR(36) NULL,
    `nature` ENUM('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE') NULL,
    `affectsGrossProfit` BOOLEAN NOT NULL DEFAULT false,
    `isPredefined` BOOLEAN NOT NULL DEFAULT false,
    `behavesAsSubLedger` BOOLEAN NOT NULL DEFAULT false,
    `nettBalances` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LedgerGroup_name_key`(`name`),
    INDEX `LedgerGroup_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ledger` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `groupId` CHAR(36) NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingSide` ENUM('DR', 'CR') NOT NULL DEFAULT 'DR',
    `systemRole` ENUM('PROFIT_AND_LOSS', 'CAPITAL', 'DRAWINGS', 'SALES_LOCAL', 'SALES_INTERSTATE', 'PURCHASE_LOCAL', 'PURCHASE_INTERSTATE', 'PURCHASE_NO_ITC', 'OUTPUT_CGST', 'OUTPUT_SGST', 'OUTPUT_IGST', 'INPUT_CGST', 'INPUT_SGST', 'INPUT_IGST', 'RCM_CGST', 'RCM_SGST', 'RCM_IGST', 'TDS_PAYABLE', 'TDS_RECEIVABLE', 'ROUND_OFF', 'STOCK_WRITE_OFF', 'STOCK_FOUND', 'STOCK_ADJUSTMENT', 'TDS_PAYABLE_VENDOR', 'DISCOUNT_ALLOWED', 'DISCOUNT_RECEIVED', 'SALES_RETURNS') NULL,
    `taxKind` ENUM('CGST', 'SGST', 'IGST', 'CESS', 'TDS', 'TCS', 'OTHER') NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ledger_name_key`(`name`),
    UNIQUE INDEX `Ledger_systemRole_key`(`systemRole`),
    INDEX `Ledger_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Scheme` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `level` ENUM('LINE', 'ORDER') NOT NULL,
    `benefit` ENUM('PERCENT', 'AMOUNT_PER_UNIT', 'FLAT_AMOUNT', 'FREE_QUANTITY') NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `buyQuantity` DECIMAL(14, 3) NULL,
    `maxDiscount` DECIMAL(12, 2) NULL,
    `minQuantity` DECIMAL(14, 3) NULL,
    `minValue` DECIMAL(14, 2) NULL,
    `partyScope` ENUM('ALL', 'SELECTED') NOT NULL DEFAULT 'ALL',
    `rateSources` JSON NOT NULL,
    `stackable` BOOLEAN NOT NULL DEFAULT false,
    `validFrom` DATE NOT NULL,
    `validTill` DATE NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Scheme_name_key`(`name`),
    INDEX `Scheme_isArchived_validFrom_idx`(`isArchived`, `validFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SchemeTarget` (
    `id` CHAR(36) NOT NULL,
    `schemeId` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NULL,
    `categoryId` CHAR(36) NULL,
    `brandId` CHAR(36) NULL,

    INDEX `SchemeTarget_schemeId_idx`(`schemeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SchemeParty` (
    `schemeId` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,

    INDEX `SchemeParty_partyId_idx`(`partyId`),
    PRIMARY KEY (`schemeId`, `partyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NULL,
    `date` DATE NOT NULL,
    `expectedDate` DATE NULL,
    `vendorId` CHAR(36) NOT NULL,
    `godownId` CHAR(36) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `terms` TEXT NULL,
    `notes` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_number_key`(`number`),
    INDEX `PurchaseOrder_vendorId_date_idx`(`vendorId`, `date`),
    INDEX `PurchaseOrder_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderLine` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `lineUnit` TEXT NULL,
    `lineQuantity` DECIMAL(14, 3) NOT NULL,
    `lineRate` DECIMAL(12, 2) NOT NULL,
    `unitFactor` DECIMAL(14, 4) NOT NULL DEFAULT 1,

    INDEX `PurchaseOrderLine_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseBill` (
    `id` CHAR(36) NOT NULL,
    `kind` ENUM('GOODS', 'CHARGES') NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NULL,
    `vendorBillNumber` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `vendorId` CHAR(36) NOT NULL,
    `vendorBranchId` CHAR(36) NULL,
    `sourceOfSupply` TEXT NULL,
    `regime` ENUM('INTRA_STATE', 'INTER_STATE', 'NO_GST', 'REVERSE_CHARGE') NOT NULL,
    `gstApplicable` BOOLEAN NOT NULL DEFAULT true,
    `godownId` CHAR(36) NULL,
    `purchaseOrderId` CHAR(36) NULL,
    `allocation` ENUM('VALUE', 'QUANTITY', 'WEIGHT') NOT NULL DEFAULT 'VALUE',
    `landedCostForId` CHAR(36) NULL,
    `ewayBillNumber` TEXT NULL,
    `ewayBillDate` DATE NULL,
    `vehicleNumber` TEXT NULL,
    `notes` TEXT NULL,
    `status` ENUM('OPEN', 'VOID') NOT NULL DEFAULT 'OPEN',
    `goodsValue` DECIMAL(14, 2) NOT NULL,
    `chargesValue` DECIMAL(14, 2) NOT NULL,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `cgst` DECIMAL(14, 2) NOT NULL,
    `sgst` DECIMAL(14, 2) NOT NULL,
    `igst` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `itcClaimable` DECIMAL(14, 2) NOT NULL,
    `itcLost` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(6, 2) NOT NULL,
    `payable` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseBill_reference_key`(`reference`),
    INDEX `PurchaseBill_date_idx`(`date`),
    INDEX `PurchaseBill_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `PurchaseBill_landedCostForId_idx`(`landedCostForId`),
    UNIQUE INDEX `PurchaseBill_vendorId_vendorBillNumber_key`(`vendorId`, `vendorBillNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseBillLine` (
    `id` CHAR(36) NOT NULL,
    `billId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `orderLineId` CHAR(36) NULL,
    `description` TEXT NOT NULL,
    `hsn` TEXT NOT NULL,
    `unit` TEXT NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `lineUnit` TEXT NULL,
    `lineQuantity` DECIMAL(14, 3) NOT NULL,
    `lineRate` DECIMAL(12, 2) NOT NULL,
    `unitFactor` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `itcEligible` BOOLEAN NOT NULL DEFAULT true,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `ownCost` DECIMAL(14, 2) NOT NULL,
    `landedShare` DECIMAL(14, 2) NOT NULL,
    `landedCost` DECIMAL(14, 2) NOT NULL,
    `landedRate` DECIMAL(14, 4) NOT NULL,

    INDEX `PurchaseBillLine_billId_idx`(`billId`),
    INDEX `PurchaseBillLine_itemId_idx`(`itemId`),
    INDEX `PurchaseBillLine_orderLineId_idx`(`orderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseBillCharge` (
    `id` CHAR(36) NOT NULL,
    `billId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `headId` CHAR(36) NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,

    INDEX `PurchaseBillCharge_billId_idx`(`billId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockBatch` (
    `id` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `godownId` CHAR(36) NOT NULL,
    `billLineId` CHAR(36) NULL,
    `transferLineId` CHAR(36) NULL,
    `sourceBatchId` CHAR(36) NULL,
    `adjustmentLineId` CHAR(36) NULL,
    `creditNoteLineId` CHAR(36) NULL,
    `date` DATE NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `remaining` DECIMAL(14, 3) NOT NULL,
    `landedRate` DECIMAL(14, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StockBatch_billLineId_key`(`billLineId`),
    UNIQUE INDEX `StockBatch_adjustmentLineId_key`(`adjustmentLineId`),
    UNIQUE INDEX `StockBatch_creditNoteLineId_key`(`creditNoteLineId`),
    INDEX `StockBatch_itemId_date_idx`(`itemId`, `date`),
    INDEX `StockBatch_transferLineId_idx`(`transferLineId`),
    INDEX `StockBatch_sourceBatchId_idx`(`sourceBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quotation` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `date` DATE NOT NULL,
    `validUntil` DATE NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `billToBranchId` CHAR(36) NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CONVERTED') NOT NULL DEFAULT 'SENT',
    `regime` ENUM('INTRA_STATE', 'INTER_STATE', 'BILL_OF_SUPPLY') NOT NULL,
    `gstApplicable` BOOLEAN NOT NULL DEFAULT true,
    `terms` TEXT NULL,
    `notes` TEXT NULL,
    `gross` DECIMAL(14, 2) NOT NULL,
    `schemeDiscount` DECIMAL(14, 2) NOT NULL,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `cgst` DECIMAL(14, 2) NOT NULL,
    `sgst` DECIMAL(14, 2) NOT NULL,
    `igst` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(6, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quotation_number_key`(`number`),
    INDEX `Quotation_partyId_date_idx`(`partyId`, `date`),
    INDEX `Quotation_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationLine` (
    `id` CHAR(36) NOT NULL,
    `quotationId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `description` TEXT NOT NULL,
    `hsn` TEXT NOT NULL,
    `unit` TEXT NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineUnit` TEXT NULL,
    `lineQuantity` DECIMAL(14, 3) NOT NULL,
    `lineRate` DECIMAL(12, 2) NOT NULL,
    `unitFactor` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `rateSource` ENUM('SPECIAL', 'SHEET', 'LAST_QUOTED', 'LAST_SOLD', 'MANUAL') NOT NULL,
    `suggestedRate` DECIMAL(12, 2) NULL,
    `itemPriceId` CHAR(36) NULL,
    `specialRateId` CHAR(36) NULL,
    `schemeDiscount` DECIMAL(14, 2) NOT NULL,
    `freeQuantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `schemes` JSON NOT NULL DEFAULT ('[]'),
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `costAtQuote` DECIMAL(14, 4) NULL,

    INDEX `QuotationLine_quotationId_idx`(`quotationId`),
    INDEX `QuotationLine_partyId_itemId_date_idx`(`partyId`, `itemId`, `date` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationRevision` (
    `id` CHAR(36) NOT NULL,
    `quotationId` CHAR(36) NOT NULL,
    `revision` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `note` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QuotationRevision_quotationId_revision_key`(`quotationId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `billToBranchId` CHAR(36) NULL,
    `shipToBranchId` CHAR(36) NULL,
    `godownId` CHAR(36) NOT NULL,
    `status` ENUM('ISSUED', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
    `regime` ENUM('INTRA_STATE', 'INTER_STATE', 'BILL_OF_SUPPLY') NOT NULL,
    `gstApplicable` BOOLEAN NOT NULL DEFAULT true,
    `placeOfSupply` TEXT NULL,
    `shipToLine` TEXT NULL,
    `shipToCity` TEXT NULL,
    `vehicleNumber` TEXT NULL,
    `vehicleId` CHAR(36) NULL,
    `notes` TEXT NULL,
    `quotationId` CHAR(36) NULL,
    `gross` DECIMAL(14, 2) NOT NULL,
    `schemeDiscount` DECIMAL(14, 2) NOT NULL,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `cgst` DECIMAL(14, 2) NOT NULL,
    `sgst` DECIMAL(14, 2) NOT NULL,
    `igst` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(6, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_issuedNumberId_key`(`issuedNumberId`),
    INDEX `Invoice_number_idx`(`number`),
    INDEX `Invoice_partyId_date_idx`(`partyId`, `date`),
    INDEX `Invoice_date_idx`(`date`),
    INDEX `Invoice_quotationId_idx`(`quotationId`),
    INDEX `Invoice_vehicleId_idx`(`vehicleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceDocument` (
    `id` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `kind` ENUM('E_INVOICE', 'LORRY_CHALLAN', 'EWAY_BILL') NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `details` JSON NOT NULL DEFAULT ('{}'),
    `savedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InvoiceDocument_kind_number_idx`(`kind`, `number`),
    UNIQUE INDEX `InvoiceDocument_invoiceId_kind_key`(`invoiceId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `description` TEXT NOT NULL,
    `hsn` TEXT NOT NULL,
    `unit` TEXT NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineUnit` TEXT NULL,
    `lineQuantity` DECIMAL(14, 3) NOT NULL,
    `lineRate` DECIMAL(12, 2) NOT NULL,
    `unitFactor` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `reportUnit` TEXT NOT NULL,
    `reportQuantity` DECIMAL(14, 3) NOT NULL,
    `rateSource` ENUM('SPECIAL', 'SHEET', 'LAST_QUOTED', 'LAST_SOLD', 'MANUAL') NOT NULL,
    `suggestedRate` DECIMAL(12, 2) NULL,
    `itemPriceId` CHAR(36) NULL,
    `specialRateId` CHAR(36) NULL,
    `schemeDiscount` DECIMAL(14, 2) NOT NULL,
    `freeQuantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `schemes` JSON NOT NULL DEFAULT ('[]'),
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `costOfGoods` DECIMAL(14, 2) NOT NULL,

    INDEX `InvoiceLine_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceLine_partyId_itemId_date_idx`(`partyId`, `itemId`, `date` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceStockDraw` (
    `id` CHAR(36) NOT NULL,
    `invoiceLineId` CHAR(36) NOT NULL,
    `batchId` CHAR(36) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,

    INDEX `InvoiceStockDraw_invoiceLineId_idx`(`invoiceLineId`),
    INDEX `InvoiceStockDraw_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransfer` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `fromGodownId` CHAR(36) NOT NULL,
    `toGodownId` CHAR(36) NOT NULL,
    `status` ENUM('POSTED', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
    `value` DECIMAL(14, 2) NOT NULL,
    `vehicleNumber` TEXT NULL,
    `vehicleId` CHAR(36) NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StockTransfer_issuedNumberId_key`(`issuedNumberId`),
    INDEX `StockTransfer_number_idx`(`number`),
    INDEX `StockTransfer_date_idx`(`date`),
    INDEX `StockTransfer_vehicleId_idx`(`vehicleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransferLine` (
    `id` CHAR(36) NOT NULL,
    `transferId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `unit` TEXT NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `value` DECIMAL(14, 2) NOT NULL,

    INDEX `StockTransferLine_transferId_idx`(`transferId`),
    INDEX `StockTransferLine_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockAdjustment` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `godownId` CHAR(36) NOT NULL,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `reason` ENUM('DAMAGED', 'LOST', 'CONSUMED', 'COUNT_SHORT', 'COUNT_EXCESS', 'FOUND', 'OTHER') NOT NULL,
    `status` ENUM('POSTED', 'CANCELLED') NOT NULL DEFAULT 'POSTED',
    `value` DECIMAL(14, 2) NOT NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StockAdjustment_issuedNumberId_key`(`issuedNumberId`),
    INDEX `StockAdjustment_number_idx`(`number`),
    INDEX `StockAdjustment_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockAdjustmentLine` (
    `id` CHAR(36) NOT NULL,
    `adjustmentId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `unit` TEXT NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NULL,
    `value` DECIMAL(14, 2) NOT NULL,

    INDEX `StockAdjustmentLine_adjustmentId_idx`(`adjustmentId`),
    INDEX `StockAdjustmentLine_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMoveDraw` (
    `id` CHAR(36) NOT NULL,
    `transferLineId` CHAR(36) NULL,
    `adjustmentLineId` CHAR(36) NULL,
    `batchId` CHAR(36) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,

    INDEX `StockMoveDraw_transferLineId_idx`(`transferLineId`),
    INDEX `StockMoveDraw_adjustmentLineId_idx`(`adjustmentLineId`),
    INDEX `StockMoveDraw_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settlement` (
    `id` CHAR(36) NOT NULL,
    `direction` ENUM('RECEIPT', 'PAYMENT') NOT NULL,
    `number` TEXT NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `mode` ENUM('BANK_TRANSFER', 'CHEQUE', 'UPI', 'CASH') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `tds` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `reference` TEXT NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Settlement_issuedNumberId_key`(`issuedNumberId`),
    INDEX `Settlement_partyId_date_idx`(`partyId`, `date`),
    INDEX `Settlement_direction_date_idx`(`direction`, `date`),
    INDEX `Settlement_accountId_date_idx`(`accountId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettlementAllocation` (
    `id` CHAR(36) NOT NULL,
    `settlementId` CHAR(36) NOT NULL,
    `invoiceId` CHAR(36) NULL,
    `billId` CHAR(36) NULL,
    `openingPartyId` CHAR(36) NULL,
    `expenseId` CHAR(36) NULL,
    `advanceId` CHAR(36) NULL,
    `creditNoteId` CHAR(36) NULL,
    `debitNoteId` CHAR(36) NULL,
    `journalLineId` CHAR(36) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SettlementAllocation_settlementId_idx`(`settlementId`),
    INDEX `SettlementAllocation_advanceId_idx`(`advanceId`),
    INDEX `SettlementAllocation_creditNoteId_idx`(`creditNoteId`),
    INDEX `SettlementAllocation_debitNoteId_idx`(`debitNoteId`),
    INDEX `SettlementAllocation_invoiceId_idx`(`invoiceId`),
    INDEX `SettlementAllocation_billId_idx`(`billId`),
    INDEX `SettlementAllocation_openingPartyId_idx`(`openingPartyId`),
    INDEX `SettlementAllocation_expenseId_idx`(`expenseId`),
    INDEX `SettlementAllocation_journalLineId_idx`(`journalLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `headId` CHAR(36) NOT NULL,
    `description` TEXT NOT NULL,
    `reference` TEXT NULL,
    `vendorId` CHAR(36) NULL,
    `payee` TEXT NULL,
    `accountId` CHAR(36) NULL,
    `mode` ENUM('BANK_TRANSFER', 'CHEQUE', 'UPI', 'CASH') NULL,
    `dueDate` DATE NULL,
    `taxSplit` TEXT NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `cgst` DECIMAL(14, 2) NOT NULL,
    `sgst` DECIMAL(14, 2) NOT NULL,
    `igst` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `itcEligible` BOOLEAN NOT NULL DEFAULT true,
    `total` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL,
    `allocation` ENUM('ITEM_COST', 'INVOICE', 'OVERHEAD') NOT NULL,
    `billId` CHAR(36) NULL,
    `invoiceId` CHAR(36) NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Expense_issuedNumberId_key`(`issuedNumberId`),
    INDEX `Expense_number_idx`(`number`),
    INDEX `Expense_date_idx`(`date`),
    INDEX `Expense_vendorId_date_idx`(`vendorId`, `date`),
    INDEX `Expense_accountId_date_idx`(`accountId`, `date`),
    INDEX `Expense_billId_idx`(`billId`),
    INDEX `Expense_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('TRUCK_10', 'TRUCK_6', 'TRAILER', 'PICKUP') NOT NULL,
    `capacityTons` DECIMAL(6, 1) NULL,
    `ownership` ENUM('OWN', 'HIRED') NOT NULL,
    `transporterId` CHAR(36) NULL,
    `driverName` TEXT NULL,
    `driverPhone` TEXT NULL,
    `notes` TEXT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_number_key`(`number`),
    INDEX `Vehicle_transporterId_idx`(`transporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditNote` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `invoiceId` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `godownId` CHAR(36) NULL,
    `reason` ENUM('GOODS_RETURNED', 'RATE_DIFFERENCE', 'DISCOUNT', 'SHORT_SUPPLY', 'OTHER') NOT NULL,
    `gstAdjusted` BOOLEAN NOT NULL DEFAULT true,
    `regime` ENUM('INTRA_STATE', 'INTER_STATE', 'BILL_OF_SUPPLY') NOT NULL,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `cgst` DECIMAL(14, 2) NOT NULL,
    `sgst` DECIMAL(14, 2) NOT NULL,
    `igst` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(6, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreditNote_issuedNumberId_key`(`issuedNumberId`),
    INDEX `CreditNote_invoiceId_idx`(`invoiceId`),
    INDEX `CreditNote_partyId_date_idx`(`partyId`, `date`),
    INDEX `CreditNote_date_idx`(`date`),
    INDEX `CreditNote_number_idx`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditNoteLine` (
    `id` CHAR(36) NOT NULL,
    `creditNoteId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `invoiceLineId` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,

    INDEX `CreditNoteLine_creditNoteId_idx`(`creditNoteId`),
    INDEX `CreditNoteLine_invoiceLineId_idx`(`invoiceLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebitNote` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `billId` CHAR(36) NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `reason` ENUM('GOODS_RETURNED', 'RATE_DIFFERENCE', 'DISCOUNT', 'SHORT_SUPPLY', 'OTHER') NOT NULL,
    `gstAdjusted` BOOLEAN NOT NULL DEFAULT true,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `cgst` DECIMAL(14, 2) NOT NULL,
    `sgst` DECIMAL(14, 2) NOT NULL,
    `igst` DECIMAL(14, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `itcReversed` DECIMAL(14, 2) NOT NULL,
    `roundOff` DECIMAL(6, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL,
    `notes` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DebitNote_issuedNumberId_key`(`issuedNumberId`),
    INDEX `DebitNote_billId_idx`(`billId`),
    INDEX `DebitNote_partyId_date_idx`(`partyId`, `date`),
    INDEX `DebitNote_date_idx`(`date`),
    INDEX `DebitNote_number_idx`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebitNoteLine` (
    `id` CHAR(36) NOT NULL,
    `debitNoteId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `billLineId` CHAR(36) NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `taxable` DECIMAL(14, 2) NOT NULL,
    `gstRatePct` DECIMAL(5, 2) NOT NULL,
    `tax` DECIMAL(14, 2) NOT NULL,
    `itcEligible` BOOLEAN NOT NULL,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `batchId` CHAR(36) NULL,

    INDEX `DebitNoteLine_debitNoteId_idx`(`debitNoteId`),
    INDEX `DebitNoteLine_billLineId_idx`(`billLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryChallan` (
    `id` CHAR(36) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedNumberId` CHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `partyId` CHAR(36) NOT NULL,
    `godownId` CHAR(36) NOT NULL,
    `quotationId` CHAR(36) NULL,
    `status` ENUM('OPEN', 'INVOICED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `invoiceId` CHAR(36) NULL,
    `shipToLine` TEXT NULL,
    `shipToCity` TEXT NULL,
    `vehicleNumber` TEXT NULL,
    `notes` TEXT NULL,
    `value` DECIMAL(14, 2) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DeliveryChallan_issuedNumberId_key`(`issuedNumberId`),
    INDEX `DeliveryChallan_partyId_date_idx`(`partyId`, `date`),
    INDEX `DeliveryChallan_status_idx`(`status`),
    INDEX `DeliveryChallan_invoiceId_idx`(`invoiceId`),
    INDEX `DeliveryChallan_quotationId_idx`(`quotationId`),
    INDEX `DeliveryChallan_number_idx`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryChallanLine` (
    `id` CHAR(36) NOT NULL,
    `challanId` CHAR(36) NOT NULL,
    `position` INTEGER NOT NULL,
    `itemId` CHAR(36) NOT NULL,
    `unit` TEXT NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL DEFAULT 0,
    `description` TEXT NULL,

    INDEX `DeliveryChallanLine_challanId_idx`(`challanId`),
    INDEX `DeliveryChallanLine_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NoteAllocation` (
    `id` CHAR(36) NOT NULL,
    `creditNoteId` CHAR(36) NULL,
    `debitNoteId` CHAR(36) NULL,
    `journalLineId` CHAR(36) NULL,
    `invoiceId` CHAR(36) NULL,
    `billId` CHAR(36) NULL,
    `expenseId` CHAR(36) NULL,
    `openingPartyId` CHAR(36) NULL,
    `journalChargeId` CHAR(36) NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NoteAllocation_creditNoteId_idx`(`creditNoteId`),
    INDEX `NoteAllocation_debitNoteId_idx`(`debitNoteId`),
    INDEX `NoteAllocation_invoiceId_idx`(`invoiceId`),
    INDEX `NoteAllocation_billId_idx`(`billId`),
    INDEX `NoteAllocation_expenseId_idx`(`expenseId`),
    INDEX `NoteAllocation_openingPartyId_idx`(`openingPartyId`),
    INDEX `NoteAllocation_journalLineId_idx`(`journalLineId`),
    INDEX `NoteAllocation_journalChargeId_idx`(`journalChargeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_accessRoleId_fkey` FOREIGN KEY (`accessRoleId`) REFERENCES `AccessRole`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Brand` ADD CONSTRAINT `Brand_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemCategory` ADD CONSTRAINT `ItemCategory_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ItemCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemCategory` ADD CONSTRAINT `ItemCategory_defaultUnitId_fkey` FOREIGN KEY (`defaultUnitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemGroup` ADD CONSTRAINT `ItemGroup_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemGroup` ADD CONSTRAINT `ItemGroup_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemGroup` ADD CONSTRAINT `ItemGroup_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemGroup` ADD CONSTRAINT `ItemGroup_defaultUnitId_fkey` FOREIGN KEY (`defaultUnitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ItemGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_reportingUnitId_fkey` FOREIGN KEY (`reportingUnitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemUnitConversion` ADD CONSTRAINT `ItemUnitConversion_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemUnitConversion` ADD CONSTRAINT `ItemUnitConversion_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemOpeningStock` ADD CONSTRAINT `ItemOpeningStock_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemOpeningStock` ADD CONSTRAINT `ItemOpeningStock_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartyBranch` ADD CONSTRAINT `PartyBranch_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartyContact` ADD CONSTRAINT `PartyContact_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartyContact` ADD CONSTRAINT `PartyContact_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `PartyBranch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartyLicence` ADD CONSTRAINT `PartyLicence_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartyLicence` ADD CONSTRAINT `PartyLicence_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `PartyBranch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HsnRate` ADD CONSTRAINT `HsnRate_hsnCodeId_fkey` FOREIGN KEY (`hsnCodeId`) REFERENCES `HsnCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpecialRate` ADD CONSTRAINT `SpecialRate_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpecialRate` ADD CONSTRAINT `SpecialRate_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpecialRate` ADD CONSTRAINT `SpecialRate_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPrice` ADD CONSTRAINT `ItemPrice_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPrice` ADD CONSTRAINT `ItemPrice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemPrice` ADD CONSTRAINT `ItemPrice_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NumberFormat` ADD CONSTRAINT `NumberFormat_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `NumberSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NumberCounter` ADD CONSTRAINT `NumberCounter_formatId_fkey` FOREIGN KEY (`formatId`) REFERENCES `NumberFormat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssuedNumber` ADD CONSTRAINT `IssuedNumber_formatId_fkey` FOREIGN KEY (`formatId`) REFERENCES `NumberFormat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalVoucher` ADD CONSTRAINT `JournalVoucher_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_journalId_fkey` FOREIGN KEY (`journalId`) REFERENCES `JournalVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_ledgerId_fkey` FOREIGN KEY (`ledgerId`) REFERENCES `Ledger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_headId_fkey` FOREIGN KEY (`headId`) REFERENCES `AccountHead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BankCashAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalLine` ADD CONSTRAINT `JournalLine_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_disbursalAccountId_fkey` FOREIGN KEY (`disbursalAccountId`) REFERENCES `BankCashAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_assetLedgerId_fkey` FOREIGN KEY (`assetLedgerId`) REFERENCES `Ledger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_repaymentAccountId_fkey` FOREIGN KEY (`repaymentAccountId`) REFERENCES `BankCashAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_interestHeadId_fkey` FOREIGN KEY (`interestHeadId`) REFERENCES `AccountHead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_tdsLedgerId_fkey` FOREIGN KEY (`tdsLedgerId`) REFERENCES `Ledger`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanEntry` ADD CONSTRAINT `LoanEntry_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanEntry` ADD CONSTRAINT `LoanEntry_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `BankCashAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportSkippedRow` ADD CONSTRAINT `ImportSkippedRow_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `ImportJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerGroup` ADD CONSTRAINT `LedgerGroup_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `LedgerGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ledger` ADD CONSTRAINT `Ledger_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `LedgerGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SchemeTarget` ADD CONSTRAINT `SchemeTarget_schemeId_fkey` FOREIGN KEY (`schemeId`) REFERENCES `Scheme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SchemeTarget` ADD CONSTRAINT `SchemeTarget_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SchemeTarget` ADD CONSTRAINT `SchemeTarget_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ItemCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SchemeTarget` ADD CONSTRAINT `SchemeTarget_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SchemeParty` ADD CONSTRAINT `SchemeParty_schemeId_fkey` FOREIGN KEY (`schemeId`) REFERENCES `Scheme`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SchemeParty` ADD CONSTRAINT `SchemeParty_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBill` ADD CONSTRAINT `PurchaseBill_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBill` ADD CONSTRAINT `PurchaseBill_vendorBranchId_fkey` FOREIGN KEY (`vendorBranchId`) REFERENCES `PartyBranch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBill` ADD CONSTRAINT `PurchaseBill_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBill` ADD CONSTRAINT `PurchaseBill_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBill` ADD CONSTRAINT `PurchaseBill_landedCostForId_fkey` FOREIGN KEY (`landedCostForId`) REFERENCES `PurchaseBill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBill` ADD CONSTRAINT `PurchaseBill_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBillLine` ADD CONSTRAINT `PurchaseBillLine_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `PurchaseBill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBillLine` ADD CONSTRAINT `PurchaseBillLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBillLine` ADD CONSTRAINT `PurchaseBillLine_orderLineId_fkey` FOREIGN KEY (`orderLineId`) REFERENCES `PurchaseOrderLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBillCharge` ADD CONSTRAINT `PurchaseBillCharge_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `PurchaseBill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseBillCharge` ADD CONSTRAINT `PurchaseBillCharge_headId_fkey` FOREIGN KEY (`headId`) REFERENCES `AccountHead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_billLineId_fkey` FOREIGN KEY (`billLineId`) REFERENCES `PurchaseBillLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_transferLineId_fkey` FOREIGN KEY (`transferLineId`) REFERENCES `StockTransferLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_sourceBatchId_fkey` FOREIGN KEY (`sourceBatchId`) REFERENCES `StockBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_adjustmentLineId_fkey` FOREIGN KEY (`adjustmentLineId`) REFERENCES `StockAdjustmentLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockBatch` ADD CONSTRAINT `StockBatch_creditNoteLineId_fkey` FOREIGN KEY (`creditNoteLineId`) REFERENCES `CreditNoteLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_billToBranchId_fkey` FOREIGN KEY (`billToBranchId`) REFERENCES `PartyBranch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_itemPriceId_fkey` FOREIGN KEY (`itemPriceId`) REFERENCES `ItemPrice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationLine` ADD CONSTRAINT `QuotationLine_specialRateId_fkey` FOREIGN KEY (`specialRateId`) REFERENCES `SpecialRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationRevision` ADD CONSTRAINT `QuotationRevision_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_billToBranchId_fkey` FOREIGN KEY (`billToBranchId`) REFERENCES `PartyBranch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_shipToBranchId_fkey` FOREIGN KEY (`shipToBranchId`) REFERENCES `PartyBranch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceDocument` ADD CONSTRAINT `InvoiceDocument_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceDocument` ADD CONSTRAINT `InvoiceDocument_savedById_fkey` FOREIGN KEY (`savedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_itemPriceId_fkey` FOREIGN KEY (`itemPriceId`) REFERENCES `ItemPrice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_specialRateId_fkey` FOREIGN KEY (`specialRateId`) REFERENCES `SpecialRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceStockDraw` ADD CONSTRAINT `InvoiceStockDraw_invoiceLineId_fkey` FOREIGN KEY (`invoiceLineId`) REFERENCES `InvoiceLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceStockDraw` ADD CONSTRAINT `InvoiceStockDraw_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `StockBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_fromGodownId_fkey` FOREIGN KEY (`fromGodownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_toGodownId_fkey` FOREIGN KEY (`toGodownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferLine` ADD CONSTRAINT `StockTransferLine_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `StockTransfer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferLine` ADD CONSTRAINT `StockTransferLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAdjustment` ADD CONSTRAINT `StockAdjustment_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAdjustment` ADD CONSTRAINT `StockAdjustment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAdjustmentLine` ADD CONSTRAINT `StockAdjustmentLine_adjustmentId_fkey` FOREIGN KEY (`adjustmentId`) REFERENCES `StockAdjustment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAdjustmentLine` ADD CONSTRAINT `StockAdjustmentLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMoveDraw` ADD CONSTRAINT `StockMoveDraw_transferLineId_fkey` FOREIGN KEY (`transferLineId`) REFERENCES `StockTransferLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMoveDraw` ADD CONSTRAINT `StockMoveDraw_adjustmentLineId_fkey` FOREIGN KEY (`adjustmentLineId`) REFERENCES `StockAdjustmentLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMoveDraw` ADD CONSTRAINT `StockMoveDraw_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `StockBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BankCashAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `PurchaseBill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_openingPartyId_fkey` FOREIGN KEY (`openingPartyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_advanceId_fkey` FOREIGN KEY (`advanceId`) REFERENCES `Settlement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_creditNoteId_fkey` FOREIGN KEY (`creditNoteId`) REFERENCES `CreditNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_debitNoteId_fkey` FOREIGN KEY (`debitNoteId`) REFERENCES `DebitNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SettlementAllocation` ADD CONSTRAINT `SettlementAllocation_journalLineId_fkey` FOREIGN KEY (`journalLineId`) REFERENCES `JournalLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_headId_fkey` FOREIGN KEY (`headId`) REFERENCES `AccountHead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `BankCashAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `PurchaseBill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_transporterId_fkey` FOREIGN KEY (`transporterId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNote` ADD CONSTRAINT `CreditNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNoteLine` ADD CONSTRAINT `CreditNoteLine_creditNoteId_fkey` FOREIGN KEY (`creditNoteId`) REFERENCES `CreditNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNoteLine` ADD CONSTRAINT `CreditNoteLine_invoiceLineId_fkey` FOREIGN KEY (`invoiceLineId`) REFERENCES `InvoiceLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditNoteLine` ADD CONSTRAINT `CreditNoteLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `PurchaseBill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNoteLine` ADD CONSTRAINT `DebitNoteLine_debitNoteId_fkey` FOREIGN KEY (`debitNoteId`) REFERENCES `DebitNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNoteLine` ADD CONSTRAINT `DebitNoteLine_billLineId_fkey` FOREIGN KEY (`billLineId`) REFERENCES `PurchaseBillLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNoteLine` ADD CONSTRAINT `DebitNoteLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNoteLine` ADD CONSTRAINT `DebitNoteLine_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `StockBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallan` ADD CONSTRAINT `DeliveryChallan_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallan` ADD CONSTRAINT `DeliveryChallan_godownId_fkey` FOREIGN KEY (`godownId`) REFERENCES `Godown`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallan` ADD CONSTRAINT `DeliveryChallan_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallan` ADD CONSTRAINT `DeliveryChallan_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallan` ADD CONSTRAINT `DeliveryChallan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallanLine` ADD CONSTRAINT `DeliveryChallanLine_challanId_fkey` FOREIGN KEY (`challanId`) REFERENCES `DeliveryChallan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryChallanLine` ADD CONSTRAINT `DeliveryChallanLine_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_creditNoteId_fkey` FOREIGN KEY (`creditNoteId`) REFERENCES `CreditNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_debitNoteId_fkey` FOREIGN KEY (`debitNoteId`) REFERENCES `DebitNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_journalLineId_fkey` FOREIGN KEY (`journalLineId`) REFERENCES `JournalLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_billId_fkey` FOREIGN KEY (`billId`) REFERENCES `PurchaseBill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_openingPartyId_fkey` FOREIGN KEY (`openingPartyId`) REFERENCES `Party`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteAllocation` ADD CONSTRAINT `NoteAllocation_journalChargeId_fkey` FOREIGN KEY (`journalChargeId`) REFERENCES `JournalLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- What the PostgreSQL migrations add beside the Prisma schema, for MySQL.
--
-- PostgreSQL has partial unique indexes; MySQL and MariaDB do not. Each one
-- here is a generated column that holds the key only on the rows the
-- PostgreSQL index covers (NULL elsewhere: NULLs never clash), with a
-- unique index on it. The columns are not in the Prisma schema; Prisma never
-- writes them.
--
-- The CHECK constraints of the PostgreSQL migrations are not repeated: the
-- services check every one of them before saving.

-- At most one default bank account.
ALTER TABLE `BankCashAccount`
  ADD COLUMN `oneDefaultKey` TINYINT AS (IF(`isDefault`, 1, NULL)) VIRTUAL,
  ADD UNIQUE INDEX `BankCashAccount_one_default` (`oneDefaultKey`);

-- An IRN or an e-way bill number belongs to one invoice only.
ALTER TABLE `InvoiceDocument`
  ADD COLUMN `oneInvoiceKey` VARCHAR(191) AS (IF(`kind` IN ('E_INVOICE', 'EWAY_BILL'), `number`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX `InvoiceDocument_one_invoice_key` (`kind`, `oneInvoiceKey`);

-- GENERATED by export-reference-data.ts from the PostgreSQL migrations.
-- The starting data every install has: see that script before editing.
SET FOREIGN_KEY_CHECKS = 0;

-- AccountHead
INSERT INTO `AccountHead` (`id`, `name`, `nature`, `gst`, `gstRatePct`, `allocation`, `notes`, `isArchived`, `createdAt`, `updatedAt`) VALUES
  ('0afff56d-021b-4157-a1f2-25d7f81f424a', 'Discount Received', 'INDIRECT_INCOME', NULL, NULL, NULL, NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('12fdcbb9-3bc0-441d-af8f-89215a29b539', 'Commission Received', 'INDIRECT_INCOME', NULL, NULL, NULL, NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('16777c2c-e018-4e11-9b55-8e2db9c1d1fa', 'Office Expenses', 'INDIRECT_EXPENSE', 'OWN_RATE', 18, 'OVERHEAD', 'Stationery, small equipment', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('2861e69c-5f1f-4695-be2f-c24fc58dfeda', 'Interest on Late Payment', 'INDIRECT_INCOME', NULL, NULL, NULL, 'Charged to buyers who pay late (MSME)', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('2b4f57e1-e146-4f9d-9a13-a41f02d7bf9b', 'Rent', 'INDIRECT_EXPENSE', 'OWN_RATE', 18, 'OVERHEAD', NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('4a71794d-7e84-4434-a1e9-d04bc3cdd702', 'Interest on Loan', 'INDIRECT_EXPENSE', 'NONE', NULL, 'OVERHEAD', 'Interest on loans we take', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('5e73efd2-7f77-433e-bc8a-596f106a89fb', 'Bank Charges', 'INDIRECT_EXPENSE', 'OWN_RATE', 18, 'OVERHEAD', 'Also bounce and penal charges on loans', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('600f252e-dcc3-42e3-b0cb-eeec4b5a3507', 'Freight Inward', 'DIRECT_EXPENSE', 'FOLLOWS_BILL', NULL, 'ITEM_COST', 'Transport of purchased goods to our yard', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('7644a174-6163-4805-80f3-f3d1bba62234', 'Repairs and Maintenance', 'INDIRECT_EXPENSE', 'OWN_RATE', 18, 'OVERHEAD', NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('79378541-da5a-42b4-a2a1-495d86b57faf', 'Interest Received', 'INDIRECT_INCOME', NULL, NULL, NULL, 'Interest on loans we give', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('8bf9b640-29ce-45af-8cb7-a548af76f5d5', 'Loading Charges', 'DIRECT_EXPENSE', 'NONE', NULL, 'INVOICE', NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('989b0bdd-c1e9-42c0-8ca6-0ee22c1ebb04', 'Labour Charges', 'DIRECT_EXPENSE', 'NONE', NULL, 'ITEM_COST', 'Stacking, sorting, cutting', 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('b72b1db6-1ed5-4d14-b441-b9941362ae84', 'Freight Outward', 'DIRECT_EXPENSE', 'OWN_RATE', 5, 'INVOICE', NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('c4f46e5b-80c0-4f12-af0a-2b6f000940fe', 'Unloading Charges', 'DIRECT_EXPENSE', 'NONE', NULL, 'ITEM_COST', NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956'),
  ('fef217f1-c9f3-4f4c-a348-f6ef13c0a5f4', 'Salary', 'INDIRECT_EXPENSE', 'NONE', NULL, 'OVERHEAD', NULL, 0, '2026-11-21 14:44:47.956', '2026-11-21 14:44:47.956');

-- BankCashAccount
INSERT INTO `BankCashAccount` (`id`, `name`, `kind`, `bankName`, `branch`, `accountNumber`, `ifsc`, `upiId`, `openingBalance`, `openingDate`, `showOnInvoice`, `ledgerName`, `isArchived`, `createdAt`, `updatedAt`, `isDefault`) VALUES
  ('524c764b-f510-4480-90fd-18f95a2bc6e0', 'Cash', 'CASH', NULL, NULL, NULL, NULL, NULL, 0, '2026-04-01', 0, NULL, 0, '2026-11-21 14:44:54.953', '2026-11-21 14:44:54.953', 0);

-- CompanyProfile
INSERT INTO `CompanyProfile` (`id`, `legalName`, `tradeName`, `gstin`, `pan`, `stateCode`, `addressLine`, `city`, `district`, `pin`, `phone`, `altPhone`, `email`, `updatedAt`, `registration`, `enforceHsnGstRate`) VALUES
  (1, 'My Company', NULL, NULL, NULL, '19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-21 14:44:46.405', 'REGULAR', 0);

-- Ledger
INSERT INTO `Ledger` (`id`, `name`, `groupId`, `openingBalance`, `openingSide`, `systemRole`, `taxKind`, `notes`, `isArchived`, `createdAt`, `updatedAt`) VALUES
  ('00fb5023-59a0-4e55-ad85-0d0e6c9ef97a', 'Round Off', '6571fec2-e273-4ac2-a568-b0b0c92ac014', 0, 'DR', 'ROUND_OFF', NULL, 'Rounding on invoices and bills', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('12e3b08c-a912-425f-8d35-24bad5d50480', 'TDS Receivable', 'e56d20c1-9b35-4abe-bd52-5fcd28eb4e22', 0, 'DR', 'TDS_RECEIVABLE', NULL, 'TDS deducted from what we are paid: customers on receipts, borrowers on interest', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('15853da9-8e1a-434b-b3a9-02fa4799489b', 'TDS Payable on Interest', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'TDS_PAYABLE', 'TDS', 'TDS we deduct on interest we pay', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('2d95488f-3da1-40ab-9c71-0a974e56efbe', 'Input CGST', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'INPUT_CGST', 'CGST', 'Claimable CGST on bills and expenses', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('30fb8238-fca2-4c81-a63b-1e6f6f283f5b', 'Profit & Loss A/c', NULL, 0, 'DR', 'PROFIT_AND_LOSS', NULL, 'Profit or loss brought forward (opening balance)', 0, '2026-11-21 14:44:48.631', '2026-11-21 14:44:48.631'),
  ('319dc702-1cf4-45ef-ac84-159963842b55', 'Purchase - GST Interstate', '8dbde605-0d15-4ac1-be82-70ac31d843f2', 0, 'DR', 'PURCHASE_INTERSTATE', NULL, 'Goods bills from vendors in other states', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('37ccf630-f426-4609-b2e3-fb2b67ba8fb3', 'Input IGST', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'INPUT_IGST', 'IGST', 'Claimable IGST on bills and expenses', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('4a9feb5b-e1df-4453-a523-65bae2177fb2', 'Owner''s Capital', '99d8e599-2b25-424a-ad8f-f2971742e8c2', 0, 'DR', 'CAPITAL', NULL, 'Money the owners bring into the business', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('571d5c6c-8353-4e00-9435-950743ca55a1', 'Output CGST', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'OUTPUT_CGST', 'CGST', 'CGST on sales', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('6458f7a8-ead6-4ec3-81da-bd53ec7f9cd5', 'Output SGST', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'OUTPUT_SGST', 'SGST', 'SGST on sales', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('6dc303b1-f2af-4dee-8e63-1a846a26d6f8', 'Sales - GST Local', 'a8a0d9bc-5adc-433b-9e87-ba80b21f85d6', 0, 'DR', 'SALES_LOCAL', NULL, 'Invoices to buyers in our state (CGST + SGST)', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('8450b48e-f705-45be-9831-7457f3d8f1eb', 'Stock Adjustment', '8dbde605-0d15-4ac1-be82-70ac31d843f2', 0, 'DR', 'STOCK_ADJUSTMENT', NULL, 'The trading side of stock adjustments; closing stock moves with it', 0, '2026-11-21 14:44:52.275', '2026-11-21 14:44:52.275'),
  ('8d9f5705-5738-4bfc-823a-977128b3bd8b', 'Sales - GST Interstate', 'a8a0d9bc-5adc-433b-9e87-ba80b21f85d6', 0, 'DR', 'SALES_INTERSTATE', NULL, 'Invoices to buyers in other states (IGST)', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('947a8701-9aab-44da-9ecc-e03433b557f4', 'Purchase - No Input Credit', '8dbde605-0d15-4ac1-be82-70ac31d843f2', 0, 'DR', 'PURCHASE_NO_ITC', NULL, 'Unregistered or composition vendors, 17(5): GST is cost', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('a5169e6d-c964-4016-bdd9-be110d7760c7', 'SGST Payable on RCM', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'RCM_SGST', 'SGST', 'Reverse charge on GTA freight', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('b34ac3bb-16c8-4d47-b65d-cf0d16d4e207', 'Sales Returns', 'a8a0d9bc-5adc-433b-9e87-ba80b21f85d6', 0, 'DR', 'SALES_RETURNS', NULL, 'Goods returned and price reductions on credit notes with GST', 0, '2026-11-21 14:44:57.367', '2026-11-21 14:44:57.367'),
  ('b395b58d-8ba7-4178-9724-45a15348f0e4', 'Drawings', '99d8e599-2b25-424a-ad8f-f2971742e8c2', 0, 'DR', 'DRAWINGS', NULL, 'Money and goods the owners take out', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('b780a166-ea57-44c3-ba43-edbef8cc3ec2', 'Output IGST', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'OUTPUT_IGST', 'IGST', 'IGST on sales and exports with IGST', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('b9cbf4c0-3879-4f28-a820-19b30864c313', 'Stock Excess Found', '788b1881-3dc0-4e01-838b-fdf65e88bbf4', 0, 'DR', 'STOCK_FOUND', NULL, 'Stock found or more on a count, at the cost entered (stock adjustments)', 0, '2026-11-21 14:44:52.275', '2026-11-21 14:44:52.275'),
  ('be2797cd-1051-4e8e-8f42-a18878ec8239', 'TDS Payable on Vendor Payments', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'TDS_PAYABLE_VENDOR', 'TDS', 'TDS we deduct when paying vendors (receipts and payments)', 0, '2026-11-21 14:44:52.84', '2026-11-21 14:44:52.84'),
  ('c4ae28f6-8585-46f9-87d3-564510772d88', 'CGST Payable on RCM', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'RCM_CGST', 'CGST', 'Reverse charge on GTA freight', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('d1357eae-6fff-4b1b-bab9-f1121478e1b7', 'Purchase - GST Local', '8dbde605-0d15-4ac1-be82-70ac31d843f2', 0, 'DR', 'PURCHASE_LOCAL', NULL, 'Goods bills from vendors in our state', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('e598dee4-26d8-4897-92fd-70c3b26cb27b', 'Stock Written Off', '6571fec2-e273-4ac2-a568-b0b0c92ac014', 0, 'DR', 'STOCK_WRITE_OFF', NULL, 'Damaged, lost or used stock, at what it cost (stock adjustments)', 0, '2026-11-21 14:44:52.275', '2026-11-21 14:44:52.275'),
  ('eaf0d87c-96d0-4357-a7f8-c87383a85866', 'IGST Payable on RCM', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'RCM_IGST', 'IGST', 'Reverse charge on GTA freight', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652'),
  ('fca83562-c477-44d3-9bc0-f90c9e28038f', 'Input SGST', '6753aaa4-5778-4606-a735-0a40754048ee', 0, 'DR', 'INPUT_SGST', 'SGST', 'Claimable SGST on bills and expenses', 0, '2026-11-21 14:44:48.652', '2026-11-21 14:44:48.652');

-- LedgerGroup
INSERT INTO `LedgerGroup` (`id`, `name`, `parentId`, `nature`, `affectsGrossProfit`, `isPredefined`, `behavesAsSubLedger`, `nettBalances`, `position`, `notes`, `createdAt`, `updatedAt`) VALUES
  ('0d3680e0-852b-4cd1-a173-b6b0a2305c50', 'Current Assets', NULL, 'ASSET', 0, 1, 0, 0, 80, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('188c5ac2-4c3b-4fe5-b8c4-c6520d47bd5a', 'Stock-in-Hand', '0d3680e0-852b-4cd1-a173-b6b0a2305c50', NULL, 0, 1, 0, 0, 5, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('22316705-8ce5-4110-a094-60ac75cf85ba', 'Branch / Divisions', NULL, 'LIABILITY', 0, 1, 0, 0, 40, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('3be18cbc-c475-41f7-8bd5-225d30e211c0', 'Direct Expenses', NULL, 'EXPENSE', 1, 1, 0, 0, 140, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('56cc3b0e-a864-47ad-915e-fb2d11aa7ad8', 'Investments', NULL, 'ASSET', 0, 1, 0, 0, 70, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('6571fec2-e273-4ac2-a568-b0b0c92ac014', 'Indirect Expenses', NULL, 'EXPENSE', 0, 1, 0, 0, 150, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('6753aaa4-5778-4606-a735-0a40754048ee', 'Duties & Taxes', 'e2f274fd-83c9-4c40-b069-b1ed7a8860fb', NULL, 0, 1, 0, 0, 1, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('6ac3dcdd-a601-4c01-9818-12024fb05526', 'Loans (Liability)', NULL, 'LIABILITY', 0, 1, 0, 0, 20, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('731fedb9-2d09-4f82-8728-c5b1649f3116', 'Suspense A/c', NULL, 'LIABILITY', 0, 1, 0, 0, 50, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('788b1881-3dc0-4e01-838b-fdf65e88bbf4', 'Indirect Incomes', NULL, 'INCOME', 0, 1, 0, 0, 120, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('7f677263-1e94-4ab6-af1d-460dc5e374d5', 'Provisions', 'e2f274fd-83c9-4c40-b069-b1ed7a8860fb', NULL, 0, 1, 0, 0, 2, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('817a370e-8c26-44aa-837f-1c041f15b744', 'Deposits (Asset)', '0d3680e0-852b-4cd1-a173-b6b0a2305c50', NULL, 0, 1, 0, 0, 3, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('872c65c8-ba4f-41be-ae6a-2f1aedb4e87e', 'Sundry Creditors', 'e2f274fd-83c9-4c40-b069-b1ed7a8860fb', NULL, 0, 1, 1, 0, 3, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('87cfc4bc-2beb-461f-ae50-921535a051c8', 'Reserves & Surplus', '99d8e599-2b25-424a-ad8f-f2971742e8c2', NULL, 0, 1, 0, 0, 1, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('8a8c6bb2-3b97-4643-867c-40e7a10868b8', 'Secured Loans', '6ac3dcdd-a601-4c01-9818-12024fb05526', NULL, 0, 1, 0, 0, 2, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('8dab91e6-6b70-4d14-98cc-cc2e9881ff77', 'Direct Incomes', NULL, 'INCOME', 1, 1, 0, 0, 110, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('8dbde605-0d15-4ac1-be82-70ac31d843f2', 'Purchase Accounts', NULL, 'EXPENSE', 1, 1, 0, 0, 130, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('99d8e599-2b25-424a-ad8f-f2971742e8c2', 'Capital Account', NULL, 'LIABILITY', 0, 1, 0, 0, 10, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('a8a0d9bc-5adc-433b-9e87-ba80b21f85d6', 'Sales Accounts', NULL, 'INCOME', 1, 1, 0, 0, 100, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('b7b0e22c-1eec-4964-b87a-634a61509217', 'Fixed Assets', NULL, 'ASSET', 0, 1, 0, 0, 60, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('d283cdb5-159e-43e1-bf9f-ad10fcd8d6aa', 'Bank Accounts', '0d3680e0-852b-4cd1-a173-b6b0a2305c50', NULL, 0, 1, 0, 0, 1, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('d54f5f7a-775d-44e2-b0e3-0c2aada70dc8', 'Cash-in-Hand', '0d3680e0-852b-4cd1-a173-b6b0a2305c50', NULL, 0, 1, 0, 0, 2, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('d5dd4aff-53a6-4afa-a0fe-1daf4b69188f', 'Sundry Debtors', '0d3680e0-852b-4cd1-a173-b6b0a2305c50', NULL, 0, 1, 1, 0, 6, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('d7d76ed7-d27f-4433-95cd-a84f8039f5be', 'Unsecured Loans', '6ac3dcdd-a601-4c01-9818-12024fb05526', NULL, 0, 1, 0, 0, 3, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('e21cadbe-2cfc-4f42-870c-c95493c8ffa8', 'Misc. Expenses (ASSET)', NULL, 'ASSET', 0, 1, 0, 0, 90, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('e2f274fd-83c9-4c40-b069-b1ed7a8860fb', 'Current Liabilities', NULL, 'LIABILITY', 0, 1, 0, 0, 30, NULL, '2026-11-21 14:44:48.543', '2026-11-21 14:44:48.543'),
  ('e56d20c1-9b35-4abe-bd52-5fcd28eb4e22', 'Loans & Advances (Asset)', '0d3680e0-852b-4cd1-a173-b6b0a2305c50', NULL, 0, 1, 0, 0, 4, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603'),
  ('e739f628-93e8-45c1-add9-7feb1bf80f42', 'Bank OD A/c', '6ac3dcdd-a601-4c01-9818-12024fb05526', NULL, 0, 1, 0, 0, 1, NULL, '2026-11-21 14:44:48.603', '2026-11-21 14:44:48.603');

-- NumberSeries
INSERT INTO `NumberSeries` (`id`, `kind`, `method`, `voucherType`, `updatedAt`) VALUES
  ('05d8d6c0-8b52-4405-b9b8-87bf65adafd5', 'PURCHASE_ORDER', 'AUTOMATIC', 'Purchase Order', '2026-11-21 14:44:50.494'),
  ('093ff367-01b0-4af8-acaf-798fc92e17e8', 'SALES_INVOICE', 'AUTOMATIC', 'Sales', '2026-11-21 14:44:46.946'),
  ('12b4f231-9d8e-42b4-9184-e0cdd2ef23f4', 'JOURNAL', 'AUTOMATIC', 'Journal', '2026-11-21 14:44:47.805'),
  ('17117e8a-1468-46ff-ad68-e590deafb2d3', 'VENDOR_CODE', 'AUTOMATIC_MANUAL_OVERRIDE', NULL, '2026-11-21 14:44:46.946'),
  ('289d1e84-325b-4ba6-82b3-f19d147531e2', 'STOCK_TRANSFER', 'AUTOMATIC', 'Stock Journal', '2026-11-21 14:44:52.084'),
  ('576ccb44-c36b-4fe0-bdc6-f70ed41b438f', 'CUSTOMER_CODE', 'AUTOMATIC_MANUAL_OVERRIDE', NULL, '2026-11-21 14:44:46.946'),
  ('5872acf5-ea6b-43a9-a0de-5a430eb54f3f', 'DEBIT_NOTE', 'AUTOMATIC', 'Debit Note', '2026-11-21 14:44:46.946'),
  ('587a3fce-0724-4ab5-bde9-9675d4631d5d', 'STOCK_JOURNAL', 'AUTOMATIC', 'Stock Journal', '2026-11-21 14:44:46.946'),
  ('75f40c7f-c857-43bc-a1a8-fe27204b494d', 'PAYMENT', 'AUTOMATIC', 'Payment', '2026-11-21 14:44:46.946'),
  ('84e3cce6-2ac4-4758-b549-5760776d5675', 'RECEIPT', 'AUTOMATIC', 'Receipt', '2026-11-21 14:44:46.946'),
  ('87700d50-b23f-49d7-bb45-9ea4118be10e', 'EXPENSE', 'AUTOMATIC', NULL, '2026-11-21 14:44:46.946'),
  ('99f4c231-7590-4b90-a40c-adc3a6c4fa5b', 'ITEM_SKU', 'AUTOMATIC_MANUAL_OVERRIDE', NULL, '2026-11-21 14:44:46.946'),
  ('9d66eb8e-5f75-4159-8d01-33e0d181f8ad', 'DELIVERY_CHALLAN', 'AUTOMATIC', 'Delivery Note', '2026-11-21 14:44:56.279'),
  ('a2564e74-beae-4d2e-b47b-effb6ee7d514', 'QUOTATION', 'AUTOMATIC', NULL, '2026-11-21 14:44:46.946'),
  ('af8cbbd7-7030-4149-95ec-2c65dd14dc86', 'PURCHASE', 'AUTOMATIC', 'Purchase', '2026-11-21 14:44:46.946'),
  ('f1c23027-35a6-4847-975d-0d1f10b74ad7', 'CREDIT_NOTE', 'AUTOMATIC', 'Credit Note', '2026-11-21 14:44:46.946');

-- SalesSettings
INSERT INTO `SalesSettings` (`id`, `invoiceInStockOnly`, `updatedAt`) VALUES
  (1, 0, '2026-11-21 14:44:51.342');

SET FOREIGN_KEY_CHECKS = 1;
