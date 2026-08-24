import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../src/jobs/jobs.types';

export async function obliterateQueues(app: INestApplication): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    const queue = app.get<Queue>(getQueueToken(name), { strict: false });
    await queue.obliterate({ force: true });
  }
}

export async function pauseQueues(app: INestApplication): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    const queue = app.get<Queue>(getQueueToken(name), { strict: false });
    await queue.pause();
  }
}

export async function waitForIdleQueues(
  app: INestApplication,
  timeout = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const active = await Promise.all(
      Object.values(QUEUES).map((name) =>
        app.get<Queue>(getQueueToken(name), { strict: false }).getActiveCount(),
      ),
    );
    if (active.every((count) => count === 0)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Queues still held active jobs when the drain timed out.');
}

interface RedisKeyspace {
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
  set(key: string, value: string, mode: 'KEEPTTL'): Promise<unknown>;
}

async function keyspace(app: INestApplication): Promise<RedisKeyspace> {
  const queue = app.get<Queue>(getQueueToken(QUEUES.PIPELINE), {
    strict: false,
  });
  return (await queue.getBackend().client) as unknown as RedisKeyspace;
}

export async function spendCredentialBudget(
  app: INestApplication,
  used: number,
): Promise<number> {
  const client = await keyspace(app);
  const keys = await client.keys('asobeast:credentials:*');
  for (const key of keys) await client.set(key, String(used), 'KEEPTTL');
  return keys.length;
}

async function clearKeys(
  app: INestApplication,
  pattern: string,
): Promise<void> {
  const client = await keyspace(app);
  const keys = await client.keys(pattern);
  if (keys.length > 0) await client.del(...keys);
}

export function clearOnDemandCounters(app: INestApplication): Promise<void> {
  return clearKeys(app, 'asobeast:on-demand:*');
}

const RATE_LIMIT_NAMESPACES = [
  'asobeast:throttle:*',
  'asobeast:rate:*',
  'asobeast:concurrency:*',
  'asobeast:credentials:*',
  'asobeast:abuse:*',
  'asobeast:recovery:*',
];

export async function clearRateLimitCounters(
  app: INestApplication,
): Promise<void> {
  for (const pattern of RATE_LIMIT_NAMESPACES) await clearKeys(app, pattern);
}
