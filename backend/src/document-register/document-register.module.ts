import { Module } from '@nestjs/common';
import { DocumentRegisterController } from './document-register.controller.js';
import { DocumentRegisterService } from './document-register.service.js';

// The dispatch documents register: every document number on invoices and
// vendor bills, and the papers still missing. Read-only.
@Module({
  controllers: [DocumentRegisterController],
  providers: [DocumentRegisterService],
  exports: [DocumentRegisterService],
})
export class DocumentRegisterModule {}
