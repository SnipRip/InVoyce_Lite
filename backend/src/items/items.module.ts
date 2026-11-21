import { Module } from '@nestjs/common';
import { ItemLedgerService } from './item-ledger.service.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService, ItemLedgerService],
  // The importer (src/imports) saves rows through it.
  exports: [ItemsService],
})
export class ItemsModule {}
