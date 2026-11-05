import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BrandKeywords } from './brand-keywords';
import { DigestService } from './digest.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioInsightsService } from './portfolio-insights.service';
import { PortfolioSignals } from './portfolio-signals.service';
import { PortfolioService } from './portfolio.service';
import { ShareOfVoiceService } from './share-of-voice.service';

@Module({
  imports: [KeywordsModule],
  controllers: [AnalyticsController, PortfolioController],
  providers: [
    AnalyticsService,
    DigestService,
    PortfolioService,
    PortfolioSignals,
    PortfolioInsightsService,
    ShareOfVoiceService,
    BrandKeywords,
  ],
  exports: [AnalyticsService, DigestService, PortfolioService],
})
export class AnalyticsModule {}
