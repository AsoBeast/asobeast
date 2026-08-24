import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { QUEUES } from '../jobs/jobs.types';
import { CollectionEligibility } from './collection-eligibility.service';
import { OnDemandLimiter } from './on-demand.limiter';
import { QuotaService } from './quota.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.PIPELINE })],
  providers: [QuotaService, OnDemandLimiter, CollectionEligibility],
  exports: [QuotaService, OnDemandLimiter, CollectionEligibility],
})
export class QuotaModule {}
