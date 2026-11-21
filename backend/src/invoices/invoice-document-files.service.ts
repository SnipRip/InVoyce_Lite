import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { DispatchDocumentKind } from '../generated/prisma/enums.js';
import { cleanFileName, documentFileProblem, documentFileType } from './document-file-rules.js';

export interface DocumentFileView {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
}

// Files kept with a dispatch document (client, 12 Nov 2026). The document
// row is locked while one is added, so two uploads never pass the count
// together. Files go with the document when it is removed (cascade).
@Injectable()
export class InvoiceDocumentFilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async documentId(invoiceId: string, kind: DispatchDocumentKind): Promise<string> {
    const document = await this.prisma.invoiceDocument.findUnique({ where: { invoiceId_kind: { invoiceId, kind } }, select: { id: true } });
    if (!document) throw new NotFoundException('Save the document first, then attach its file');
    return document.id;
  }

  async add(invoiceId: string, kind: DispatchDocumentKind, upload: { buffer: Uint8Array; originalname?: string }, userId: string): Promise<DocumentFileView> {
    const documentId = await this.documentId(invoiceId, kind);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "InvoiceDocument" WHERE "id" = ${documentId}::uuid FOR UPDATE`;
      const count = await tx.invoiceDocumentFile.count({ where: { documentId } });
      const problem = documentFileProblem(upload.buffer, count);
      if (problem) throw new BadRequestException(problem);
      const type = documentFileType(upload.buffer)!;
      const file = await tx.invoiceDocumentFile.create({
        data: { documentId, name: cleanFileName(upload.originalname, type), contentType: type, size: upload.buffer.length, bytes: Buffer.from(upload.buffer), uploadedById: userId },
        select: { id: true, name: true, contentType: true, size: true, createdAt: true },
      });
      return { ...file, createdAt: file.createdAt.toISOString() };
    });
  }

  async get(invoiceId: string, kind: DispatchDocumentKind, fileId: string) {
    const file = await this.prisma.invoiceDocumentFile.findFirst({
      where: { id: fileId, document: { invoiceId, kind } },
      select: { name: true, contentType: true, bytes: true },
    });
    if (!file) throw new NotFoundException('That file is not on this document');
    return file;
  }

  async remove(invoiceId: string, kind: DispatchDocumentKind, fileId: string): Promise<void> {
    const { count } = await this.prisma.invoiceDocumentFile.deleteMany({ where: { id: fileId, document: { invoiceId, kind } } });
    if (!count) throw new NotFoundException('That file is not on this document');
  }
}
