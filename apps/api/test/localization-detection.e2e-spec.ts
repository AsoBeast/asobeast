import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppDetail, AppStoreLocalization } from '@asobeast/shared';
import { Job, Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DetectLocalizationPayload,
  JOBS,
  QUEUES,
  RefreshAppPayload,
} from '../src/jobs/jobs.types';
import { LocalizationSweep } from '../src/jobs/localization-sweep.service';
import { StoreJobsHandler } from '../src/jobs/store-jobs.handler';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import {
  ENGLISH,
  GERMAN,
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

  const captureListing = (appId: string, country: string) =>
    app.get(StoreJobsHandler).handle({
      name: JOBS.REFRESH_APP,
      id: `refresh-${country}`,
      queueName: QUEUES.APP_STORE,
      data: {
        appId,
        country,
        workspaceId: DEFAULT_WORKSPACE_ID,
      } satisfies RefreshAppPayload,
    } as Job);

  const detectionJobs = async () =>
    (
      await app
        .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
        .getJobs(['prioritized'])
    )
      .filter((job) => job.name === JOBS.DETECT_LOCALIZATION)
      .map((job) => job.data as DetectLocalizationPayload);

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

  it('records nothing when the store echoes the home listing in another market', async () => {
    const appId = await importApp();
    registry.listings.set('de:default', GERMAN);
    await captureListing(appId, 'de');
    registry.listings.set('de:en-GB', ENGLISH);

    await runProbe(appId, 'en-GB', 'de');

    await expect(localizationsOf(appId)).resolves.toEqual([
      { localization: 'de', origin: 'detected' },
    ]);
  });

  it('records a localization served in another market apart from its default and the home listing', async () => {
    const appId = await importApp();
    registry.listings.set('de:default', GERMAN);
    await captureListing(appId, 'de');
    registry.listings.set('de:en-GB', POLISH);

    await runProbe(appId, 'en-GB', 'de');

    await expect(localizationsOf(appId)).resolves.toEqual([
      { localization: 'de', origin: 'detected' },
      { localization: 'en-GB', origin: 'detected' },
    ]);
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

  describe('after the first listing capture of a market', () => {
    beforeEach(async () => {
      await obliterateQueues(app);
      await pauseQueues(app);
    });

    it('queues the probes of the localizations that market reads', async () => {
      const appId = await importApp();

      await captureListing(appId, 'ch');

      const probes = await detectionJobs();
      expect(
        probes
          .filter((probe) => probe.country === 'ch')
          .map((probe) => probe.localization)
          .sort(),
      ).toEqual(['en-GB', 'it']);
      expect(probes.every((probe) => probe.appId === appId)).toBe(true);
    });

    it('queues nothing more on a later capture of the same market', async () => {
      const appId = await importApp();
      await captureListing(appId, 'ch');
      const before = (await detectionJobs()).length;

      await captureListing(appId, 'ch');

      await expect(detectionJobs()).resolves.toHaveLength(before);
    });
  });

  describe('the weekly sweep', () => {
    beforeEach(async () => {
      await obliterateQueues(app);
      await pauseQueues(app);
    });

    it('queues one probe per candidate of every primary app store app', async () => {
      const appId = await importApp();
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: 'GOOGLE_PLAY',
          storeAppId: 'com.example.sweep',
          country: 'us',
          name: 'Play app',
        },
      });

      const queued = await app.get(LocalizationSweep).run();

      const probes = await detectionJobs();
      expect(queued).toBeGreaterThan(0);
      expect(probes).toHaveLength(queued);
      expect(probes.every((probe) => probe.appId === appId)).toBe(true);
    });

    it('queues nothing more when it runs twice the same day', async () => {
      await importApp();
      await app.get(LocalizationSweep).run();
      const before = (await detectionJobs()).length;

      await expect(app.get(LocalizationSweep).run()).resolves.toBe(0);
      await expect(detectionJobs()).resolves.toHaveLength(before);
    });
  });
});
