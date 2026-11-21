import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentAuth } from '../common/decorators/current-auth.decorator.js';
import { RequireAccess } from '../common/decorators/require-access.decorator.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import type { ChallanView } from './challan-views.js';
import { ChallansService } from './challans.service.js';
import { CancelChallanDto, CreateChallanDto } from './dto/challan.dto.js';

/** The screen's permission key (frontend config/navigation.ts). */
export const CHALLANS_MODULE = '/delivery-challans';

@Controller('delivery-challans')
export class ChallansController {
  constructor(private readonly challans: ChallansService) {}

  @RequireAccess(CHALLANS_MODULE, 'view')
  @Get()
  list(): Promise<ChallanView[]> {
    return this.challans.list();
  }

  @RequireAccess(CHALLANS_MODULE, 'view')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ChallanView> {
    return this.challans.get(id);
  }

  @RequireAccess(CHALLANS_MODULE, 'create')
  @Post()
  create(@Body() dto: CreateChallanDto, @CurrentAuth() auth: AuthContext): Promise<ChallanView> {
    return this.challans.create(dto, auth.userId);
  }

  @RequireAccess(CHALLANS_MODULE, 'edit')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelChallanDto): Promise<ChallanView> {
    return this.challans.cancel(id, dto.reason);
  }
}
