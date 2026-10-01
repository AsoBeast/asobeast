import { Global, Module } from '@nestjs/common';
import { CollectionEligibility } from './collection-eligibility.service';
import { OnDemandLimiter } from './on-demand.limiter';
import { QuotaService } from './quota.service';

@Global()
@Module({
  providers: [QuotaService, OnDemandLimiter, CollectionEligibility],
  exports: [QuotaService, OnDemandLimiter, CollectionEligibility],
})
export class QuotaModule {}
