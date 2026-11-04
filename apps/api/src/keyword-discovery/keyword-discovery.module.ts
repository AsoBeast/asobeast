import { Module } from '@nestjs/common';
import { DiscoveryCandidates } from './discovery-candidates.service';
import { DiscoveryCaptures } from './discovery-captures';
import { DiscoveryPopularity } from './discovery-popularity.service';

@Module({
  providers: [DiscoveryPopularity, DiscoveryCandidates, DiscoveryCaptures],
  exports: [DiscoveryPopularity, DiscoveryCandidates, DiscoveryCaptures],
})
export class KeywordDiscoveryModule {}
