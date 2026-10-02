import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class RateLimitStorageModule {}
