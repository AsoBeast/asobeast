import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../jobs/jobs.types';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.PIPELINE })],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class RateLimitStorageModule {}
