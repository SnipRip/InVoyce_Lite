-- The picture shown for an item everywhere (client, 12 Nov 2026).
-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "primaryPictureId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Item_primaryPictureId_key" ON "Item"("primaryPictureId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_primaryPictureId_fkey" FOREIGN KEY ("primaryPictureId") REFERENCES "ItemPicture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

