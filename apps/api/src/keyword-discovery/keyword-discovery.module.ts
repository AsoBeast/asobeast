import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { KeywordsModule } from '../keywords/keywords.module';
import { RankingsModule } from '../rankings/rankings.module';
import { DiscoveryCheck } from './discovery-check.service';
import { DiscoveryCandidates } from './discovery-candidates.service';
import { DiscoveryCaptures } from './discovery-captures';
import { KeywordDiscoveryPlanner } from './discovery-planner.service';
import { DiscoveryPoolStore } from './discovery-pool-store';
import { DiscoveryPopularity } from './discovery-popularity.service';
import { DiscoveryTracker } from './discovery-tracker.service';

@Module({
  imports: [
    KeywordsModule,
    RankingsModule,
    BullModule.registerQueue(
      { name: QUEUES.APP_STORE },
      { name: QUEUES.GPLAY },
    ),
  ],
  providers: [
    DiscoveryPopularity,
    DiscoveryCandidates,
    DiscoveryCaptures,
    DiscoveryPoolStore,
    DiscoveryTracker,
    KeywordDiscoveryPlanner,
    DiscoveryCheck,
  ],
  exports: [
    DiscoveryPopularity,
    DiscoveryCandidates,
    DiscoveryCaptures,
    DiscoveryTracker,
    KeywordDiscoveryPlanner,
    DiscoveryCheck,
  ],
})
export class KeywordDiscoveryModule {}
