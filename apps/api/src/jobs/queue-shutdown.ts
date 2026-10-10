import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { FailFastRedis } from '../redis/fail-fast-redis';
import {
  discoveredFlowProducers,
  discoveredQueues,
  discoveredWorkers,
} from './discovered-queues';

export const PING_ATTEMPTS = 3;
export const PING_PAUSE_MS = 300;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class QueueShutdown implements BeforeApplicationShutdown {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly redis: FailFastRedis,
  ) {}

  async beforeApplicationShutdown(): Promise<void> {
    if (await this.redisAnswers()) return;
    const backends = [
      ...discoveredQueues(this.discovery),
      ...discoveredFlowProducers(this.discovery),
    ].map((client) => client.getBackend());
    await Promise.all([
      ...discoveredWorkers(this.discovery).map((worker) => worker.close(true)),
      ...backends.map((backend) => backend.close(true)),
    ]);
  }

  private async redisAnswers(): Promise<boolean> {
    for (let attempt = 1; attempt <= PING_ATTEMPTS; attempt++) {
      if (await this.pinged()) return true;
      if (attempt < PING_ATTEMPTS) await elapse(PING_PAUSE_MS);
    }
    return false;
  }

  private pinged(): Promise<boolean> {
    return this.redis.runOpen(async (client) => {
      await client.ping();
      return true;
    }, false);
  }
}
