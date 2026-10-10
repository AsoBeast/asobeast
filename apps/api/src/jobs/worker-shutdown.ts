import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { discoveredWorkers } from './discovered-queues';

@Injectable()
export class WorkerShutdown implements BeforeApplicationShutdown {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly redis: FailFastRedis,
  ) {}

  async beforeApplicationShutdown(): Promise<void> {
    if (await this.redisAnswers()) return;
    await Promise.all(
      discoveredWorkers(this.discovery).map((worker) => worker.close(true)),
    );
  }

  private redisAnswers(): Promise<boolean> {
    return this.redis.runOpen(async (client) => {
      await client.ping();
      return true;
    }, false);
  }
}
