import { Module } from '@nestjs/common';
import { StoreProvidersModule } from '../store-providers/store-providers.module';
import { ScoringService } from './scoring.service';
import { StatsCollectorService } from './stats-collector.service';

@Module({
  imports: [StoreProvidersModule],
  providers: [StatsCollectorService, ScoringService],
  exports: [StatsCollectorService, ScoringService],
})
export class ScoringModule {}
