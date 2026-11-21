import { Module } from '@nestjs/common';
import { NumberSeriesModule } from '../number-series/number-series.module.js';
import { CreditNotesService } from './credit-notes.service.js';
import { DebitNotesService } from './debit-notes.service.js';
import { NoteAllocationsService } from './note-allocations.service.js';
import { SettlementsModule } from '../settlements/settlements.module.js';
import { CreditNotesController, DebitNotesController } from './notes.controllers.js';

// Credit notes against invoices (CREDIT_NOTE series) and debit notes against
// goods bills (DEBIT_NOTE series); both post to the books (books.service.ts)
// and settle their document up to what it still owes; the rest is the
// party's credit, applied later or refunded (note-allocations.service.ts).
@Module({
  imports: [NumberSeriesModule, SettlementsModule],
  controllers: [CreditNotesController, DebitNotesController],
  providers: [CreditNotesService, DebitNotesService, NoteAllocationsService],
  exports: [NoteAllocationsService],
})
export class NotesModule {}
