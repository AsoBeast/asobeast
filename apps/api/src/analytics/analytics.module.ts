import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DigestService } from './digest.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  controllers: [AnalyticsController, PortfolioController],
  providers: [AnalyticsService, DigestService, PortfolioService],
  exports: [AnalyticsService, DigestService, PortfolioService],
})
export class AnalyticsModule {}
