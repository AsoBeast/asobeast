import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../../jobs/jobs.types';
import { sha256 } from '../password-hash';
import { windowKey } from './window';

export const RECOVERY_REQUESTS_PER_HOUR = 3;

const HOUR_SECONDS = 60 * 60;

interface RequestCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

@Injectable()
export class RecoveryRateLimiter {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue) {}

  async claim(account: string, now = new Date()): Promise<boolean> {
    const client = (await this.queue.getBackend()
      .client) as unknown as RequestCounter;
    const key = windowKey(
      'recovery',
      sha256(account),
      'requested',
      HOUR_SECONDS,
      now,
    );
    const used = await client.incr(key);
    if (used === 1) await client.expire(key, HOUR_SECONDS);
    return used <= RECOVERY_REQUESTS_PER_HOUR;
  }
}
