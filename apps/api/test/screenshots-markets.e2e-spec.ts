import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  AppDetail,
  ChangeEventItem,
  ChangeTimeline,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AlertsDispatcher } from '../src/alerts/alerts.dispatcher';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { OCR_ENGINE } from '../src/screenshots/ocr-engine';
import { ScreenshotImageSource } from '../src/store-providers/screenshot-image.source';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
} from './helpers/screenshot-store';
import {
  lines,
  readsFinished,
  solidPng,
  until,
} from './helpers/screenshot-reading';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

describe('Screenshots of market listings (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new FakeScreenshotRegistry();
  const read = jest.fn();
  const engineRead = jest.fn();

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
      .overrideProvider(ScreenshotImageSource)
      .useValue({ read })
      .overrideProvider(OCR_ENGINE)
      .useValue({ name: 'fake-engine', read: engineRead })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();

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
    registry.screenshots = [appleShot(1), appleShot(2)];
    read.mockReset().mockResolvedValue(await solidPng());
    engineRead.mockReset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importAndRead = async (): Promise<string> => {
    const imported = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const detail = imported.body as AppDetail;
    await readsFinished(app, prisma, detail.latestSnapshot?.id as string);
    return detail.id;
  };

  const trackIn = async (appId: string, country: string) => {
    const keyword = await prisma.keyword.create({
      data: { text: 'gewohnheit', store: Store.APP_STORE, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const refreshAndRead = async (appId: string, country?: string) => {
    const query = country ? `?country=${country}` : '';
    const response = await api
      .post(`/apps/${appId}/refresh${query}`)
      .expect(200);
    const { snapshotId } = response.body as SnapshotDiffResult;
    await readsFinished(app, prisma, snapshotId);
    return snapshotId;
  };

  const events = async (
    appId: string,
    field: string,
    country?: string,
  ): Promise<ChangeEventItem[]> => {
    const query = country ? `?country=${country}` : '';
    const { events: all } = (
      await api.get(`/apps/${appId}/changes${query}`).expect(200)
    ).body as ChangeTimeline;
    return all.filter((event) => event.field === field);
  };

  const competitorOf = async (primaryAppId: string): Promise<string> => {
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId,
      },
    });
    return rival.id;
  };

  const runRefreshJob = async (appId: string, country: string) => {
    const job = await app
      .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
      .add(JOBS.REFRESH_APP, {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId,
        country,
      });
    await until(async () => (await job.getState()) === 'completed');
    const latest = await prisma.appSnapshot.findFirstOrThrow({
      where: { appId, country },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    });
    await readsFinished(app, prisma, latest.id);
    return latest.id;
  };

  it('reads the market listing of a competitor from its refresh job and records its changes in that market without an alert', async () => {
    engineRead.mockResolvedValue(lines('Track habits'));
    const primaryId = await importAndRead();
    await trackIn(primaryId, 'de');
    const rivalId = await competitorOf(primaryId);
    const dispatch = jest.spyOn(app.get(AlertsDispatcher), 'dispatch');
    registry.markets.set('de', [appleShot(5), appleShot(6)]);
    engineRead
      .mockReset()
      .mockResolvedValueOnce(lines('Gewohnheiten'))
      .mockResolvedValueOnce(lines('Plane deine Woche'));

    const first = await runRefreshJob(rivalId, 'de');

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshotId: first },
      orderBy: { position: 'asc' },
    });
    expect(rows.map((row) => [row.status, row.caption, row.recipe])).toEqual([
      ['read', 'Gewohnheiten', 'ocr1:eng+deu'],
      ['read', 'Plane deine Woche', 'ocr1:eng+deu'],
    ]);
    expect(engineRead).toHaveBeenCalledWith(expect.anything(), ['eng', 'deu']);

    registry.markets.set('de', [appleShot(5), appleShot(7)]);
    engineRead.mockResolvedValueOnce(lines('Plane deinen Tag'));
    await runRefreshJob(rivalId, 'de');

    const recorded = await prisma.changeEvent.findMany({
      where: {
        appId: rivalId,
        field: { in: ['screenshotImages', 'screenshotCaptions'] },
      },
      orderBy: { field: 'asc' },
      select: { field: true, country: true },
    });
    expect(recorded).toEqual([
      { field: 'screenshotCaptions', country: 'de' },
      { field: 'screenshotImages', country: 'de' },
    ]);
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        app: expect.objectContaining({ id: rivalId }) as unknown,
      }),
    );
    dispatch.mockRestore();
  });

  it('records a replaced market screenshot in that market and never compares it with the home listing', async () => {
    engineRead.mockResolvedValue(lines('Track habits'));
    const appId = await importAndRead();
    await trackIn(appId, 'de');
    registry.markets.set('de', [appleShot(5), appleShot(6)]);
    await refreshAndRead(appId, 'de');
    registry.markets.set('de', [appleShot(5), appleShot(7)]);

    await refreshAndRead(appId, 'de');
    await refreshAndRead(appId);

    const market = await events(appId, 'screenshotImages', 'de');
    expect(market).toHaveLength(1);
    expect(market[0]).toMatchObject({
      country: 'de',
      before: '2 screenshots',
      after: '2 screenshots, 1 replaced',
    });
    await expect(events(appId, 'screenshotImages')).resolves.toEqual([]);
  });

  it('lists the screenshot reorder of a market in its refresh answer', async () => {
    engineRead.mockResolvedValue(lines('Track habits'));
    const appId = await importAndRead();
    await trackIn(appId, 'de');
    registry.markets.set('de', [appleShot(5), appleShot(6)]);
    await refreshAndRead(appId, 'de');
    registry.markets.set('de', [appleShot(6), appleShot(5)]);

    const response = await api
      .post(`/apps/${appId}/refresh?country=de`)
      .expect(200);
    const body = response.body as SnapshotDiffResult;
    await readsFinished(app, prisma, body.snapshotId);

    expect(body.country).toBe('de');
    expect(body.changes).toEqual([
      {
        field: 'screenshotImages',
        before: '2 screenshots',
        after: '2 screenshots, reordered',
      },
    ]);
  });

  it('reads the screenshots of a market listing with the language of that storefront', async () => {
    engineRead.mockResolvedValue(lines('Track habits'));
    const appId = await importAndRead();
    await trackIn(appId, 'de');
    registry.markets.set('de', [appleShot(5), appleShot(6)]);
    engineRead.mockReset().mockResolvedValue(lines('Gewohnheiten'));

    const snapshotId = await refreshAndRead(appId, 'de');

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshotId },
      orderBy: { position: 'asc' },
    });
    expect(rows.map((row) => [row.status, row.caption, row.recipe])).toEqual([
      ['read', 'Gewohnheiten', 'ocr1:eng+deu'],
      ['read', 'Gewohnheiten', 'ocr1:eng+deu'],
    ]);
    expect(engineRead).toHaveBeenCalledWith(expect.anything(), ['eng', 'deu']);
  });

  it('records a market caption change in that market only', async () => {
    engineRead
      .mockResolvedValueOnce(lines('Track habits'))
      .mockResolvedValueOnce(lines('Plan your week'));
    const appId = await importAndRead();
    await trackIn(appId, 'de');
    registry.markets.set('de', [appleShot(5), appleShot(6)]);
    engineRead
      .mockResolvedValueOnce(lines('Gewohnheiten'))
      .mockResolvedValueOnce(lines('Plane deine Woche'));
    await refreshAndRead(appId, 'de');
    registry.markets.set('de', [appleShot(5), appleShot(7)]);
    engineRead.mockResolvedValueOnce(lines('Plane deinen Tag'));

    await refreshAndRead(appId, 'de');
    await refreshAndRead(appId);

    const market = await events(appId, 'screenshotCaptions', 'de');
    expect(market).toHaveLength(1);
    expect(market[0]).toMatchObject({
      country: 'de',
      before: 'Gewohnheiten | Plane deine Woche',
      after: 'Gewohnheiten | Plane deinen Tag',
    });
    await expect(events(appId, 'screenshotCaptions')).resolves.toEqual([]);
  });
});
