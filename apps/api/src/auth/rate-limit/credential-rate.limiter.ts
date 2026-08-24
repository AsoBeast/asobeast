import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MINUTE_SECONDS } from '@asobeast/shared';
import { QUEUES } from '../../jobs/jobs.types';
import { CredentialRateLimitError } from './rate-limit.errors';
import { secondsUntilReset, windowKey } from './window';

export const CREDENTIAL_FAILURES_PER_MINUTE = 120;

interface FailureCounter {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

@Injectable()
export class CredentialRateLimiter {
  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue) {}

  async assertAddressMayPresentOne(
    address: string,
    now = new Date(),
  ): Promise<void> {
    const client = await this.client();
    const failures = Number((await client.get(keyFor(address, now))) ?? 0);
    if (failures < CREDENTIAL_FAILURES_PER_MINUTE) return;

    throw new CredentialRateLimitError(secondsUntilReset(MINUTE_SECONDS, now));
  }

  async recordRejection(address: string, now = new Date()): Promise<void> {
    const client = await this.client();
    const key = keyFor(address, now);
    if ((await client.incr(key)) === 1) {
      await client.expire(key, MINUTE_SECONDS);
    }
  }

  private async client(): Promise<FailureCounter> {
    return (await this.queue.getBackend().client) as unknown as FailureCounter;
  }
}

function keyFor(address: string, now: Date): string {
  return windowKey('credentials', address, 'rejected', MINUTE_SECONDS, now);
}
