import { Injectable } from '@nestjs/common';
import { sha256 } from '../password-hash';
import { FailFastRedis } from '../../redis/fail-fast-redis';
import { windowKey } from './window';

export const RECOVERY_REQUESTS_PER_HOUR = 3;

const HOUR_SECONDS = 60 * 60;

@Injectable()
export class RecoveryRateLimiter {
  constructor(private readonly redis: FailFastRedis) {}

  async claim(account: string, now = new Date()): Promise<boolean> {
    const key = windowKey(
      'recovery',
      sha256(account),
      'requested',
      HOUR_SECONDS,
      now,
    );
    const used = await this.redis.run(async (client) => {
      const hits = await client.incr(key);
      if (hits === 1) await client.expire(key, HOUR_SECONDS);
      return hits;
    });
    return used <= RECOVERY_REQUESTS_PER_HOUR;
  }
}
