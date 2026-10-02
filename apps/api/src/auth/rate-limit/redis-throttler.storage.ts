import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { FailFastRedis } from '../../redis/fail-fast-redis';

const NAMESPACE = 'asobeast:throttle';

export interface ThrottlerWindow {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export function throttlerKey(throttlerName: string, key: string): string {
  return `${NAMESPACE}:${throttlerName}:${key}`;
}

function seconds(milliseconds: number): number {
  return Math.ceil(milliseconds / 1000);
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: FailFastRedis) {}

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerWindow> {
    return this.redis.run(async (client) => {
      const counter = throttlerKey(throttlerName, key);

      const totalHits = await client.incr(counter);
      if (totalHits === 1) await client.pexpire(counter, ttl);
      const timeToExpire = seconds(await this.remaining(client, counter, ttl));

      if (totalHits <= limit) {
        return {
          totalHits,
          timeToExpire,
          isBlocked: false,
          timeToBlockExpire: 0,
        };
      }
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: seconds(
          await this.block(client, `${counter}:blocked`, blockDuration),
        ),
      };
    });
  }

  private async block(
    client: Redis,
    key: string,
    blockDuration: number,
  ): Promise<number> {
    const held = await client.pttl(key);
    if (held > 0) return held;
    await client.set(key, '1', 'PX', blockDuration);
    return blockDuration;
  }

  private async remaining(
    client: Redis,
    key: string,
    ttl: number,
  ): Promise<number> {
    const held = await client.pttl(key);
    if (held > 0) return held;
    await client.pexpire(key, ttl);
    return ttl;
  }
}
