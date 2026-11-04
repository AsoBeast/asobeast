import { Module } from '@nestjs/common';
import { DiscoveryCandidates } from './discovery-candidates.service';
import { DiscoveryPopularity } from './discovery-popularity.service';

@Module({
  providers: [DiscoveryPopularity, DiscoveryCandidates],
  exports: [DiscoveryPopularity, DiscoveryCandidates],
})
export class KeywordDiscoveryModule {}
