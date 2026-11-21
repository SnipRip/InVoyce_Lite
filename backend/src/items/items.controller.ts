import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequireAccess } from '../common/decorators/require-access.decorator.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { ListItemsQueryDto } from './dto/list-items-query.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import type { ItemView } from './item-view.js';
import { ITEMS_MODULE } from './items-module-key.js';
import { ItemsService } from './items.service.js';
import { ItemLedgerService, type ItemHistoryRow, type ItemStockDetailView } from './item-ledger.service.js';

// Reading is open to every signed-in user: rate enquiry, quotations and
// bills all pick items. Changes need the Items permission.
@Controller('items')
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly ledger: ItemLedgerService,
  ) {}

  @Get()
  list(@Query() query: ListItemsQueryDto): Promise<ItemView[]> {
    return this.items.list(query);
  }

  /** The batches still in stock with their purchase rates, and what open challans hold (stock enquiry). */
  @RequireAccess(ITEMS_MODULE, 'view')
  @Get(':id/stock-detail')
  stockDetail(@Param('id', ParseUUIDPipe) id: string): Promise<ItemStockDetailView> {
    return this.ledger.stockDetail(id);
  }

  /** Every live document that moved the item, with the running stock. */
  @RequireAccess(ITEMS_MODULE, 'view')
  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string): Promise<ItemHistoryRow[]> {
    return this.ledger.history(id);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ItemView> {
    return this.items.get(id);
  }

  @RequireAccess(ITEMS_MODULE, 'create')
  @Post()
  create(@Body() dto: CreateItemDto): Promise<ItemView> {
    return this.items.create(dto);
  }

  @RequireAccess(ITEMS_MODULE, 'edit')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto): Promise<ItemView> {
    return this.items.update(id, dto);
  }

  @RequireAccess(ITEMS_MODULE, 'delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.items.remove(id);
  }
}
