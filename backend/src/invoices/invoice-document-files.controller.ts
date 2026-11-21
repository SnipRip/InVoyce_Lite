import {
  BadRequestException,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  NestInterceptor,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError, throwError, type Observable } from 'rxjs';
import { CurrentAuth } from '../common/decorators/current-auth.decorator.js';
import { RequireAccess } from '../common/decorators/require-access.decorator.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import { DispatchDocumentKind } from '../generated/prisma/enums.js';
import { DOCUMENT_FILE_TOO_LARGE, MAX_DOCUMENT_FILE_BYTES } from './document-file-rules.js';
import { InvoiceDocumentFilesService, type DocumentFileView } from './invoice-document-files.service.js';
import { INVOICES_MODULE } from './invoices.controller.js';

/** Multer's 413 for a file over the limit becomes a 400 that says what to do. */
@Injectable()
class FileTooLargeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(catchError((error: unknown) => throwError(() => (error instanceof PayloadTooLargeException ? new BadRequestException(DOCUMENT_FILE_TOO_LARGE) : error))));
  }
}

// Scans and PDFs kept with a dispatch document. Seeing one needs Invoices
// view; adding or removing one counts as editing the invoice.
@Controller('invoices/:id/documents/:kind/files')
export class InvoiceDocumentFilesController {
  constructor(private readonly files: InvoiceDocumentFilesService) {}

  @RequireAccess(INVOICES_MODULE, 'view')
  @Get(':fileId')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind', new ParseEnumPipe(DispatchDocumentKind)) kind: DispatchDocumentKind,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<StreamableFile> {
    const file = await this.files.get(id, kind, fileId);
    // A PDF opens in the browser; the name is plain text from cleanFileName.
    return new StreamableFile(file.bytes, { type: file.contentType, length: file.bytes.length, disposition: `inline; filename="${file.name}"` });
  }

  /** Adds one file (multipart field `file`). */
  @RequireAccess(INVOICES_MODULE, 'edit')
  @Post()
  @UseInterceptors(FileTooLargeInterceptor, FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_FILE_BYTES, files: 1, fields: 0 } }))
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind', new ParseEnumPipe(DispatchDocumentKind)) kind: DispatchDocumentKind,
    @UploadedFile() upload: { buffer: Buffer; originalname?: string } | undefined,
    @CurrentAuth() auth: AuthContext,
  ): Promise<DocumentFileView> {
    if (!upload) throw new BadRequestException('Choose a file to upload');
    return this.files.add(id, kind, upload, auth.userId);
  }

  @RequireAccess(INVOICES_MODULE, 'edit')
  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind', new ParseEnumPipe(DispatchDocumentKind)) kind: DispatchDocumentKind,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<void> {
    return this.files.remove(id, kind, fileId);
  }
}
