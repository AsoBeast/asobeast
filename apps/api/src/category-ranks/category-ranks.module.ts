import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { ChartsModule } from '../charts/charts.module';
import { CategoryRanksController } from './category-ranks.controller';
import { CategoryRanksService } from './category-ranks.service';
import { ChartAlertsService } from './chart-alerts.service';

@Module({
  imports: [ChartsModule, AlertsModule],
  controllers: [CategoryRanksController],
  providers: [CategoryRanksService, ChartAlertsService],
  exports: [CategoryRanksService],
})
export class CategoryRanksModule {}
