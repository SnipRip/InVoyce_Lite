-- Scans and PDFs kept with each dispatch document (client, 12 Nov 2026).
-- CreateTable
CREATE TABLE "InvoiceDocumentFile" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDocumentFile_documentId_createdAt_idx" ON "InvoiceDocumentFile"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "InvoiceDocumentFile" ADD CONSTRAINT "InvoiceDocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InvoiceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDocumentFile" ADD CONSTRAINT "InvoiceDocumentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The same limits as document-file-rules.ts: PDF or picture, up to 2 MB.
ALTER TABLE "InvoiceDocumentFile" ADD CONSTRAINT "InvoiceDocumentFile_type" CHECK ("contentType" IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE "InvoiceDocumentFile" ADD CONSTRAINT "InvoiceDocumentFile_size" CHECK ("size" > 0 AND "size" <= 2097152 AND octet_length("bytes") = "size");
