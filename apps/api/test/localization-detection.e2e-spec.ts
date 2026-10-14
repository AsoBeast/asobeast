import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppDetail, AppStoreLocalization } from '@asobeast/shared';
import { Job } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DetectLocalizationPayload,
  JOBS,
  QUEUES,
} from '../src/jobs/jobs.types';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  LocalizedRegistry,
  POLISH,
  US_APP_URL,
} from './helpers/localized-store';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Localization detection probe (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new LocalizedRegistry();

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(registry)
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
    registry.reset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importApp = async () => {
    const { id } = (
      await api.post('/apps').send({ url: US_APP_URL }).expect(201)
    ).body as AppDetail;
    registry.calls.length = 0;
    return id;
  };

  const runProbe = (
    appId: string,
    localization: AppStoreLocalization,
    country: string,
  ) =>
    app.get(StoreJobsHandler).handle({
      name: JOBS.DETECT_LOCALIZATION,
      id: 'probe-1',
      queueName: QUEUES.APP_STORE,
      data: {
        appId,
        localization,
        country,
        workspaceId: DEFAULT_WORKSPACE_ID,
      } satisfies DetectLocalizationPayload,
    } as Job);

  const localizationsOf = (appId: string) =>
    prisma.appLocalization.findMany({
      where: { appId },
      orderBy: { localization: 'asc' },
      select: { localization: true, origin: true },
    });

  it('records a localization the store serves as detected', async () => {
    const appId = await importApp();
    registry.listings.set('us:es-MX', POLISH);

    await runProbe(appId, 'es-MX', 'us');

    await expect(localizationsOf(appId)).resolves.toEqual([
      { localization: 'es-MX', origin: 'detected' },
    ]);
    expect(registry.calls).toEqual([{ country: 'us', localization: 'es-MX' }]);
  });

  it('records nothing when the store echoes the default listing', async () => {
    const appId = await importApp();

    await runProbe(appId, 'es-MX', 'us');

    await expect(localizationsOf(appId)).resolves.toEqual([]);
  });

  it('sends no request for a market without a stored default listing', async () => {
    const appId = await importApp();
    registry.listings.set('mx:es-MX', POLISH);

    await runProbe(appId, 'es-MX', 'mx');

    expect(registry.calls).toEqual([]);
    await expect(localizationsOf(appId)).resolves.toEqual([]);
  });

  it('keeps a manual localization manual', async () => {
    const appId = await importApp();
    await api
      .post(`/apps/${appId}/localizations`)
      .send({ localization: 'es-MX' })
      .expect(201);
    registry.listings.set('us:es-MX', POLISH);

    await runProbe(appId, 'es-MX', 'us');

    await expect(localizationsOf(appId)).resolves.toEqual([
      { localization: 'es-MX', origin: 'manual' },
    ]);
  });

  it('fails the job when the lookup fails', async () => {
    const appId = await importApp();
    registry.failing = 'es-MX';

    await expect(runProbe(appId, 'es-MX', 'us')).rejects.toThrow(
      'lookup failed for es-MX',
    );
    await expect(localizationsOf(appId)).resolves.toEqual([]);
  });
});
