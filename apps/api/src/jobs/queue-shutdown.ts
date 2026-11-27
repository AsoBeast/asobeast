import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { RedisClient, Worker } from 'bullmq';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { MAX_RECONNECT_DELAY_MS } from '../redis/reconnect-delay';
import {
  discoveredFlowProducers,
  discoveredQueues,
  discoveredWorkers,
} from './discovered-queues';
import { HttpDrain } from './http-drain';

export const PING_ATTEMPTS = 3;
export const PING_PAUSE_MS = 300;
export const UNREACHABLE_DRAIN_MS = 2_000;
export const RECONNECT_GRACE_MS = 2 * MAX_RECONNECT_DELAY_MS;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const SETTLED_STATUSES = new Set(['ready', 'wait', 'end']);

type BlockingClients = Map<Worker, RedisClient | null>;

const isSettled = (client: RedisClient | null | undefined): boolean =>
  client === null ||
  (client !== undefined && SETTLED_STATUSES.has(client.status));

const settled = (client: RedisClient): Promise<void> =>
  isSettled(client)
    ? Promise.resolve()
    : new Promise((resolve) => client.once('ready', () => resolve()));

async function trackBlocking(
  worker: Worker,
  clients: BlockingClients,
): Promise<void> {
  const blocking = worker.getBackend().blockingClient;
  if (!blocking) {
    clients.set(worker, null);
    return;
  }
  const client = await blocking;
  clients.set(worker, client);
  await settled(client);
}

async function stillReconnecting(
  workers: Worker[],
  graceMs: number,
): Promise<Worker[]> {
  const clients: BlockingClients = new Map();
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  try {
    await Promise.race([
      Promise.allSettled(
        workers.map((worker) => trackBlocking(worker, clients)),
      ),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
  return workers.filter((worker) => !isSettled(clients.get(worker)));
}

@Injectable()
export class QueueShutdown implements OnModuleDestroy {
  private readonly logger = new Logger(QueueShutdown.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly redis: FailFastRedis,
    private readonly drain: HttpDrain,
  ) {}

  async onModuleDestroy(): Promise<void> {
    const workers = discoveredWorkers(this.discovery);
    if (await this.redisAnswers()) {
      await this.forceCloseReconnecting(workers);
      return;
    }
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

  private async forceCloseReconnecting(workers: Worker[]): Promise<void> {
    const stuck = await stillReconnecting(workers, RECONNECT_GRACE_MS);
    if (stuck.length === 0) return;
    this.logger.warn(
      `shutdown: ${stuck.length} workers were still reconnecting to redis after ${RECONNECT_GRACE_MS} ms, force closed them`,
    );
    await Promise.allSettled(stuck.map((worker) => worker.close(true)));
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
