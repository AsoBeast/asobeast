import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { FailFastRedis } from '../redis/fail-fast-redis';
import {
  discoveredFlowProducers,
  discoveredQueues,
  discoveredWorkers,
} from './discovered-queues';
import { HttpDrain } from './http-drain';

export const PING_ATTEMPTS = 3;
export const PING_PAUSE_MS = 300;
export const UNREACHABLE_DRAIN_MS = 2_000;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class QueueShutdown implements BeforeApplicationShutdown {
  private readonly logger = new Logger(QueueShutdown.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly redis: FailFastRedis,
    private readonly drain: HttpDrain,
  ) {}

  async beforeApplicationShutdown(): Promise<void> {
    if (await this.redisAnswers()) return;
    const workers = discoveredWorkers(this.discovery);
    const backends = [
      ...discoveredQueues(this.discovery),
      ...discoveredFlowProducers(this.discovery),
    ].map((client) => client.getBackend());
    this.drain.cutAfter(UNREACHABLE_DRAIN_MS);
    this.logger.warn(
      `shutdown: redis is unreachable, force closed ${workers.length} workers and ${backends.length} queue connections, open http requests are cut in ${UNREACHABLE_DRAIN_MS} ms`,
    );
    await Promise.allSettled([
      ...workers.map((worker) => worker.close(true)),
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
    return this.redis
      .runOpen(async (client) => {
        await client.ping();
        return true;
      }, false)
      .catch(() => true);
  }
}
