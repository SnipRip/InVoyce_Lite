import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentAuth } from '../common/decorators/current-auth.decorator.js';
import { RequireAccess } from '../common/decorators/require-access.decorator.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import { ApplyAdvanceDto } from '../settlements/dto/settlement.dto.js';
import { CreditNotesService } from './credit-notes.service.js';
import { NoteAllocationsService } from './note-allocations.service.js';
import { DebitNotesService } from './debit-notes.service.js';
import { CancelNoteDto, CreateCreditNoteDto, CreateDebitNoteDto } from './dto/note.dto.js';
import type { CreditNoteView, DebitNoteView } from './note-views.js';

/** The screens' permission keys (frontend config/navigation.ts). */
export const CREDIT_NOTES_MODULE = '/credit-notes';
export const DEBIT_NOTES_MODULE = '/debit-notes';

@Controller('credit-notes')
export class CreditNotesController {
  constructor(
    private readonly notes: CreditNotesService,
    private readonly allocations: NoteAllocationsService,
  ) {}

  /** Applies what the note still holds as the party's credit to their other documents or opening balance. */
  @RequireAccess(CREDIT_NOTES_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/allocations')
  async apply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApplyAdvanceDto): Promise<CreditNoteView> {
    await this.allocations.apply('CREDIT_NOTE', id, dto.allocations);
    return this.notes.get(id);
  }

  @RequireAccess(CREDIT_NOTES_MODULE, 'view')
  @Get()
  list(): Promise<CreditNoteView[]> {
    return this.notes.list();
  }

  @RequireAccess(CREDIT_NOTES_MODULE, 'view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CreditNoteView> {
    return this.notes.get(id);
  }

  @RequireAccess(CREDIT_NOTES_MODULE, 'create')
  @Post()
  create(@Body() dto: CreateCreditNoteDto, @CurrentAuth() auth: AuthContext): Promise<CreditNoteView> {
    return this.notes.create(dto, auth.userId);
  }

  @RequireAccess(CREDIT_NOTES_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelNoteDto): Promise<CreditNoteView> {
    return this.notes.cancel(id, dto.reason);
  }
}

@Controller('debit-notes')
export class DebitNotesController {
  constructor(
    private readonly notes: DebitNotesService,
    private readonly allocations: NoteAllocationsService,
  ) {}

  /** Applies what the note still holds as the party's credit to their other documents or opening balance. */
  @RequireAccess(DEBIT_NOTES_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/allocations')
  async apply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApplyAdvanceDto): Promise<DebitNoteView> {
    await this.allocations.apply('DEBIT_NOTE', id, dto.allocations);
    return this.notes.get(id);
  }

  @RequireAccess(DEBIT_NOTES_MODULE, 'view')
  @Get()
  list(): Promise<DebitNoteView[]> {
    return this.notes.list();
  }

  @RequireAccess(DEBIT_NOTES_MODULE, 'view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<DebitNoteView> {
    return this.notes.get(id);
  }

  @RequireAccess(DEBIT_NOTES_MODULE, 'create')
  @Post()
  create(@Body() dto: CreateDebitNoteDto, @CurrentAuth() auth: AuthContext): Promise<DebitNoteView> {
    return this.notes.create(dto, auth.userId);
  }

  @RequireAccess(DEBIT_NOTES_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelNoteDto): Promise<DebitNoteView> {
    return this.notes.cancel(id, dto.reason);
  }
}
