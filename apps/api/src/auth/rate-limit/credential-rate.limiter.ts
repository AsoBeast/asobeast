import { Injectable } from '@nestjs/common';
import { MINUTE_SECONDS } from '@asobeast/shared';
import { CredentialRateLimitError } from './rate-limit.errors';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { secondsUntilReset, windowKey } from './window';

export const CREDENTIAL_FAILURES_PER_MINUTE = 120;

@Injectable()
export class CredentialRateLimiter {
  constructor(private readonly redis: FailFastRedis) {}

  async assertAddressMayPresentOne(
    address: string,
    now = new Date(),
  ): Promise<void> {
    const failures = await this.redis.runOpen(
      async (client) => Number((await client.get(keyFor(address, now))) ?? 0),
      0,
    );
    if (failures < CREDENTIAL_FAILURES_PER_MINUTE) return;

    throw new CredentialRateLimitError(secondsUntilReset(MINUTE_SECONDS, now));
  }

  async recordRejection(address: string, now = new Date()): Promise<void> {
    await this.redis.runOpen(async (client) => {
      const key = keyFor(address, now);
      if ((await client.incr(key)) === 1) {
        await client.expire(key, MINUTE_SECONDS);
      }
    }, undefined);
  }
}

function keyFor(address: string, now: Date): string {
  return windowKey('credentials', address, 'rejected', MINUTE_SECONDS, now);
}
