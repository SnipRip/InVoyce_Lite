import { Module } from '@nestjs/common';
import { NumberSeriesModule } from '../number-series/number-series.module.js';
import { ChallansController } from './challans.controller.js';
import { ChallansService } from './challans.service.js';

// Delivery challans (DELIVERY_CHALLAN series): goods sent ahead of the
// invoice; nothing posts to the books until the invoice.
@Module({
  imports: [NumberSeriesModule],
  controllers: [ChallansController],
  providers: [ChallansService],
})
export class ChallansModule {}
