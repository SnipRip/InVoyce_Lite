import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentAuth } from '../common/decorators/current-auth.decorator.js';
import { RequireAccess } from '../common/decorators/require-access.decorator.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import { ApplyAdvanceDto } from '../settlements/dto/settlement.dto.js';
import { CancelJournalDto, CreateJournalDto } from './dto/journal.dto.js';
import type { JournalView } from './journal-views.js';
import { JournalsService } from './journals.service.js';

/** The screen's permission key (frontend config/navigation.ts). */
export const JOURNALS_MODULE = '/journals';

@Controller('journals')
export class JournalsController {
  constructor(private readonly journals: JournalsService) {}

  @RequireAccess(JOURNALS_MODULE, 'view')
  @Get()
  list(): Promise<JournalView[]> {
    return this.journals.list();
  }

  @RequireAccess(JOURNALS_MODULE, 'view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<JournalView> {
    return this.journals.get(id);
  }

  @RequireAccess(JOURNALS_MODULE, 'create')
  @Post()
  create(@Body() dto: CreateJournalDto, @CurrentAuth() auth: AuthContext): Promise<JournalView> {
    return this.journals.create(dto, auth.userId);
  }

  /** Applies what a settling customer / vendor line still holds as credit to their open documents. */
  @RequireAccess(JOURNALS_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/lines/:lineId/allocations')
  applyCredit(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string, @Body() dto: ApplyAdvanceDto): Promise<JournalView> {
    return this.journals.applyCredit(id, lineId, dto.allocations);
  }

  @RequireAccess(JOURNALS_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelJournalDto): Promise<JournalView> {
    return this.journals.cancel(id, dto.reason);
  }
}
