import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module.js';
import { NumberSeriesModule } from '../number-series/number-series.module.js';
import { SettlementsModule } from '../settlements/settlements.module.js';
import { JournalsController } from './journals.controller.js';
import { JournalsService } from './journals.service.js';

// Journal vouchers (JOURNAL series): ledgers debited and credited by hand,
// posted to the books by books.service.ts. Lines on a customer or vendor
// settle or add to their outstanding (journal-rules.ts).
@Module({
  imports: [NumberSeriesModule, SettlementsModule, NotesModule],
  controllers: [JournalsController],
  providers: [JournalsService],
})
export class JournalsModule {}
