import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { QUEUES } from '../../jobs/jobs.types';

const NAMESPACE = 'asobeast:throttle';

export interface ThrottlerWindow {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export interface RedisWindowClient {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
  set(
    key: string,
    value: string,
    mode: 'PX',
    milliseconds: number,
  ): Promise<unknown>;
}

export function throttlerKey(throttlerName: string, key: string): string {
  return `${NAMESPACE}:${throttlerName}:${key}`;
}

function seconds(milliseconds: number): number {
  return Math.ceil(milliseconds / 1000);
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerWindow> {
    const client = await this.client();
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
  }

  private async block(
    client: RedisWindowClient,
    key: string,
    blockDuration: number,
  ): Promise<number> {
    const held = await client.pttl(key);
    if (held > 0) return held;
    await client.set(key, '1', 'PX', blockDuration);
    return blockDuration;
  }

  private async remaining(
    client: RedisWindowClient,
    key: string,
    ttl: number,
  ): Promise<number> {
    const held = await client.pttl(key);
    if (held > 0) return held;
    await client.pexpire(key, ttl);
    return ttl;
  }

  private async client(): Promise<RedisWindowClient> {
    return (await this.queue.getBackend()
      .client) as unknown as RedisWindowClient;
  }
}
