import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentAuth } from '../common/decorators/current-auth.decorator.js';
import type { AuthContext } from '../common/types/authenticated-request.js';
import { ReportQueryDto } from './dto/report-query.dto.js';
import { ItemSummaryService, type ItemSummaryView } from './item-summary.service.js';
import { ReportsService, type ReportView } from './reports.service.js';

// The services check Reports and every screen the report's data comes from.
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly itemSummary: ItemSummaryService,
  ) {}

  /** One item: stock, lots with batch-wise profit, rates over time, months, customers and vendors. */
  @Get('item-summary/:itemId')
  item(@CurrentAuth() auth: AuthContext, @Param('itemId', ParseUUIDPipe) itemId: string): Promise<ItemSummaryView> {
    return this.itemSummary.summary(auth, itemId);
  }

  @Get(':id')
  report(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Query() query: ReportQueryDto): Promise<ReportView> {
    return this.reports.report(auth, id, query);
  }
}
