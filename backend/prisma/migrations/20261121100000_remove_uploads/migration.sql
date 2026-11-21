-- Remove uploads: InVoyce Lite keeps no files. Item pictures and the scans
-- attached to IRN, e-way bill and lorry challan records are deleted with
-- their tables; the records themselves stay.
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_primaryPictureId_fkey";

-- DropForeignKey
ALTER TABLE "ItemPicture" DROP CONSTRAINT "ItemPicture_itemId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceDocumentFile" DROP CONSTRAINT "InvoiceDocumentFile_documentId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceDocumentFile" DROP CONSTRAINT "InvoiceDocumentFile_uploadedById_fkey";

-- DropIndex
DROP INDEX "Item_primaryPictureId_key";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "primaryPictureId";

-- DropTable
DROP TABLE "ItemPicture";

-- DropTable
DROP TABLE "InvoiceDocumentFile";

