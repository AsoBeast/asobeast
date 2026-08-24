import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { QUEUES } from '../../jobs/jobs.types';
import { RateLimitStorageModule } from './rate-limit-storage.module';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { AbuseMonitor } from '../abuse/abuse-monitor.service';
import { WorkspaceSuspension } from '../abuse/workspace-suspension.service';
import { CredentialRateLimiter } from './credential-rate.limiter';
import { RecoveryRateLimiter } from './recovery-rate.limiter';
import { RequestRateLimiter } from './request-rate.limiter';
import { trackerOf } from './request-tracker';

export const AUTH_THROTTLER = 'default';

const AUTH_THROTTLER_TTL_MS = 60_000;
const AUTH_THROTTLER_LIMIT = 10;

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.PIPELINE }),
    ThrottlerModule.forRootAsync({
      imports: [RateLimitStorageModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        getTracker: trackerOf,
        throttlers: [
          {
            name: AUTH_THROTTLER,
            ttl: AUTH_THROTTLER_TTL_MS,
            limit: AUTH_THROTTLER_LIMIT,
          },
        ],
      }),
    }),
  ],
  providers: [
    RequestRateLimiter,
    CredentialRateLimiter,
    RecoveryRateLimiter,
    AbuseMonitor,
    WorkspaceSuspension,
  ],
  exports: [
    RequestRateLimiter,
    CredentialRateLimiter,
    RecoveryRateLimiter,
    AbuseMonitor,
    WorkspaceSuspension,
  ],
})
export class RateLimitModule {}
