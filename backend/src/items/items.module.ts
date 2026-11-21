import { Module } from '@nestjs/common';
import { ItemPicturesController } from './item-pictures.controller.js';
import { ItemLedgerService } from './item-ledger.service.js';
import { ItemPicturesService } from './item-pictures.service.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';

@Module({
  controllers: [ItemsController, ItemPicturesController],
  providers: [ItemsService, ItemPicturesService, ItemLedgerService],
  // The importer (src/imports) saves rows through it.
  exports: [ItemsService],
})
export class ItemsModule {}
