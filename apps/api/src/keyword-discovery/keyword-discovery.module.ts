import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { DiscoveryCandidates } from './discovery-candidates.service';
import { DiscoveryCaptures } from './discovery-captures';
import { DiscoveryPopularity } from './discovery-popularity.service';
import { DiscoveryTracker } from './discovery-tracker.service';

@Module({
  imports: [KeywordsModule],
  providers: [
    DiscoveryPopularity,
    DiscoveryCandidates,
    DiscoveryCaptures,
    DiscoveryTracker,
  ],
  exports: [
    DiscoveryPopularity,
    DiscoveryCandidates,
    DiscoveryCaptures,
    DiscoveryTracker,
  ],
})
export class KeywordDiscoveryModule {}
