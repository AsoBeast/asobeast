import { Injectable } from '@nestjs/common';
import { MINUTE_SECONDS } from '@asobeast/shared';
import { CredentialRateLimitError } from './rate-limit.errors';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { secondsUntilReset, windowKey } from './window';

export const CREDENTIAL_FAILURES_PER_MINUTE = 120;

@Injectable()
export class CredentialRateLimiter {
  constructor(private readonly redis: FailFastRedis) {}

  async recordRejection(address: string, now = new Date()): Promise<void> {
    const rejections = await this.redis.runOpen(async (client) => {
      const key = keyFor(address, now);
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, MINUTE_SECONDS);
      return count;
    }, 0);
    if (rejections <= CREDENTIAL_FAILURES_PER_MINUTE) return;

    throw new CredentialRateLimitError(secondsUntilReset(MINUTE_SECONDS, now));
  }
}

function keyFor(address: string, now: Date): string {
  return windowKey('credentials', address, 'rejected', MINUTE_SECONDS, now);
}
