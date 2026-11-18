import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, ProxyProtocol, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ProxyPoolConfig } from '../src/store-providers/egress/proxy-pool.config';
import { ProxyPoolMaintenance } from '../src/store-providers/egress/proxy-pool.maintenance';
import { LEASE_HOLD_MS } from '../src/store-providers/egress/proxy-pool.service';
import {
  GOOGLE_PLAY_LIB,
  GooglePlayAppResult,
  GooglePlayAvailabilityResult,
} from '../src/store-providers/google-play.lib';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';

const HELD_ID = 'com.example.held';
const PLAY_URL = `https://play.google.com/store/apps/details?id=${HELD_ID}&gl=us`;
const PROMPT_ANSWER_MS = 5_000;
const CASE_TIMEOUT_MS = 30_000;

const listingOf = (appId: string): GooglePlayAppResult => ({
  appId,
  title: 'Held',
  summary: 'Short description',
  description: 'Full description',
  icon: 'https://example.com/icon.png',
  score: 4.2,
  ratings: 5000,
  minInstalls: 1000000,
  price: 0,
  version: '6.0',
  updated: 1719792000000,
  genre: 'Travel & Local',
  genreId: 'TRAVEL_AND_LOCAL',
  screenshots: [],
});

const playApp = jest.fn((options: { appId: string }) =>
  Promise.resolve(listingOf(options.appId)),
);
const playAvailability = jest.fn(
  (options: { appId: string }): Promise<GooglePlayAvailabilityResult> =>
    Promise.resolve({
      appId: options.appId,
      countries: { de: { status: 'available' } },
    }),
);

const poolConfig = {
  provider: 'webshare',
  enabled: true,
  apiUrl: 'http://127.0.0.1:9',
  apiKey: '',
  syncCron: '0 2 * * *',
  endpointRpm: 3000,
  minIntervalMs: 20,
  acquireTimeoutMs: 120_000,
  pollMs: 5_000,
  maxWorkerConcurrency: 8,
  interactiveReserve: 1,
  residentialUrl: undefined,
  residentialCredentials: undefined,
  residentialTariff: { mbPerRequest: 1.2, costPerGb: 3, monthlyCapUsd: 0 },
  credentialsFor: () => undefined,
};

const poolMaintenance = {
  enabled: false,
  cron: '0 2 * * *',
  ensureInitialized: () => Promise.resolve(),
  run: () => Promise.resolve(),
};

describe('Requests someone waits for on a busy proxy pool (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GOOGLE_PLAY_LIB)
      .useValue({ app: playApp, availability: playAvailability })
      .overrideProvider(ProxyPoolConfig)
      .useValue(poolConfig)
      .overrideProvider(ProxyPoolMaintenance)
      .useValue(poolMaintenance)
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    playApp.mockClear();
    playAvailability.mockClear();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "ProxyEndpoint" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProxyEndpoint" CASCADE');
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  let nextPort = 8080;
  const endpoint = (id: string, country: string) =>
    prisma.proxyEndpoint.create({
      data: {
        id,
        provider: 'test',
        externalId: id,
        host: '10.0.0.1',
        port: nextPort++,
        protocol: ProxyProtocol.HTTP,
        credentialRef: 'none',
        country,
        enabled: true,
      },
    });

  const holdForQueuedWork = (endpointId: string) =>
    prisma.proxyHealth.create({
      data: {
        endpointId,
        store: Store.GOOGLE_PLAY,
        lastUsedAt: new Date(),
        pacedUntil: new Date(Date.now() + LEASE_HOLD_MS),
      },
    });

  const seedPlayApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.GOOGLE_PLAY,
        storeAppId: HELD_ID,
        country: 'us',
        name: 'Held',
      },
    });

  const timed = async <T>(send: () => Promise<T>) => {
    const started = Date.now();
    const response = await send();
    return { response, tookMs: Date.now() - started };
  };

  it(
    'imports a play app through a free endpoint abroad while queued work holds the local one',
    async () => {
      await endpoint('us-1', 'us');
      await endpoint('de-1', 'de');
      await holdForQueuedWork('us-1');

      const { response, tookMs } = await timed(() =>
        api.post('/apps').send({ url: PLAY_URL }),
      );

      expect(response.status).toBe(201);
      expect(tookMs).toBeLessThan(PROMPT_ANSWER_MS);
      expect(playApp).toHaveBeenCalledTimes(1);
      const abroad = await prisma.proxyHealth.findUniqueOrThrow({
        where: {
          endpointId_store: { endpointId: 'de-1', store: Store.GOOGLE_PLAY },
        },
      });
      expect(abroad.lastUsedAt).not.toBeNull();
    },
    CASE_TIMEOUT_MS,
  );

  it(
    'refreshes a play listing through a free endpoint abroad',
    async () => {
      await endpoint('us-1', 'us');
      await endpoint('de-1', 'de');
      await holdForQueuedWork('us-1');
      const seeded = await seedPlayApp();

      const { response, tookMs } = await timed(() =>
        api.post(`/apps/${seeded.id}/refresh`),
      );

      expect(response.status).toBe(200);
      expect(tookMs).toBeLessThan(PROMPT_ANSWER_MS);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    'checks a play market through a free endpoint abroad',
    async () => {
      await endpoint('de-1', 'de');
      await endpoint('us-1', 'us');
      await holdForQueuedWork('de-1');
      const seeded = await seedPlayApp();

      const { response, tookMs } = await timed(() =>
        api.get(`/apps/${seeded.id}/market-availability?country=de`),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ country: 'de', status: 'available' });
      expect(tookMs).toBeLessThan(PROMPT_ANSWER_MS);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    'still waits for its own country when no endpoint abroad is free',
    async () => {
      await endpoint('us-1', 'us');
      await holdForQueuedWork('us-1');

      const response = await api.post('/apps').send({ url: PLAY_URL });

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(playApp).not.toHaveBeenCalled();
      expect(await prisma.app.count()).toBe(0);
    },
    CASE_TIMEOUT_MS,
  );
});
