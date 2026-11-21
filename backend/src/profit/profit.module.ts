import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module.js';
import { ProfitController } from './profit.controller.js';
import { ProfitService } from './profit.service.js';

// Actual profit: by invoice, customer and item, with
// overheads off for net profit. Read-only.
@Module({
  imports: [BooksModule],
  controllers: [ProfitController],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class ProfitModule {}
