import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { RankingAlertsService } from './ranking-alerts.service';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';
import { SerpController } from './serp.controller';
import { SerpService } from './serp.service';

@Module({
  imports: [StoreProvidersModule, AlertsModule, KeywordsModule],
  controllers: [RankingsController, SerpController],
  providers: [RankingsService, RankingAlertsService, SerpService],
  exports: [RankingsService, SerpService],
})
export class RankingsModule {}
