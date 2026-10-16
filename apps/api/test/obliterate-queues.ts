import { getQueueToken, WorkerHost } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Queue } from 'bullmq';
import { QUEUES } from '../src/jobs/jobs.types';
import { PipelineWorker } from '../src/jobs/pipeline.worker';

function queuesOf(app: INestApplication): Queue[] {
  return Object.values(QUEUES).map((name) =>
    app.get<Queue>(getQueueToken(name), { strict: false }),
  );
}

export async function obliterateQueues(app: INestApplication): Promise<void> {
  const queues = queuesOf(app);
  await Promise.all(queues.map((queue) => queue.pause()));
  await waitForIdleQueues(app);
  for (const queue of queues) {
    for (const parent of await queue.getJobs(['waiting-children'])) {
      await parent.remove({ removeChildren: false });
    }
    await queue.obliterate({ force: true });
  }
}

export async function closeWorkers(app: INestApplication): Promise<void> {
  const hosts = app
    .get(DiscoveryService, { strict: false })
    .getProviders()
    .map((wrapper): unknown => wrapper.instance)
    .filter(
      (instance): instance is WorkerHost => instance instanceof WorkerHost,
    );
  await Promise.all(hosts.map((host) => host.worker.close()));
}

export async function settleBootRegistration(
  app: INestApplication,
): Promise<void> {
  await app.get(PipelineWorker, { strict: false }).schedulesRegistered();
}

export async function pauseQueues(app: INestApplication): Promise<void> {
  for (const queue of queuesOf(app)) await queue.pause();
  await settleBootRegistration(app);
}

export async function waitForIdleQueues(
  app: INestApplication,
  timeout = 15_000,
): Promise<void> {
  const queues = queuesOf(app);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const active = await Promise.all(
      queues.map((queue) => queue.getActiveCount()),
    );
    if (active.every((count) => count === 0)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Queues still held active jobs when the drain timed out.');
}

export async function isolateQueues(
  app: INestApplication,
  ...running: (typeof QUEUES)[keyof typeof QUEUES][]
): Promise<void> {
  await pauseQueues(app);
  await obliterateQueues(app);
  await pauseQueues(app);
  for (const name of running) {
    await app.get<Queue>(getQueueToken(name), { strict: false }).resume();
  }
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
  'asobeast:confirmation:*',
];

export async function clearRateLimitCounters(
  app: INestApplication,
): Promise<void> {
  for (const pattern of RATE_LIMIT_NAMESPACES) await clearKeys(app, pattern);
}
