import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { RedisClient } from 'bullmq';
import { App } from 'supertest/types';
import { discoveredWorkers } from '../src/jobs/discovered-queues';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { restoreAuthEnv } from './helpers/auth-env';
import { pauseQueues } from './obliterate-queues';

const SHUTDOWN_DEADLINE_MS = 8_000;
const RECONNECT_HELD_MS = 60_000;
const STATUS_POLL_MS = 10;
const NO_STORE = {
  get: () => {
    throw new Error('no store request may leave in this spec');
  },
};

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function holdReconnecting(client: RedisClient): Promise<void> {
  client.options.retryStrategy = () => RECONNECT_HELD_MS;
  client.disconnect(true);
  while (client.status !== 'reconnecting') await elapse(STATUS_POLL_MS);
}

describe('Shutdown while a worker connection waits to reconnect (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let closing: Promise<void> | undefined;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const { AppModule } = await import('../src/app.module');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(NO_STORE)
      .compile();
    app = moduleFixture.createNestApplication<App>();
    await app.init();
    await pauseQueues(app);
  });

  afterAll(async () => {
    try {
      if (app && !closing) await app.close();
    } finally {
      restoreAuthEnv();
    }
  });

  it(
    'stops promptly although redis answers and one worker connection is still reconnecting',
    async () => {
      const running = app as INestApplication<App>;
      const [worker] = discoveredWorkers(running.get(DiscoveryService));
      const blocking = await worker.getBackend().blockingClient;
      if (!blocking) throw new Error('the worker has no blocking connection');
      await holdReconnecting(blocking);

      closing = running.close();
      const stopped = await Promise.race([
        closing.then(() => true),
        elapse(SHUTDOWN_DEADLINE_MS).then(() => false),
      ]);

      expect(stopped).toBe(true);
    },
    SHUTDOWN_DEADLINE_MS + 5_000,
  );
});
