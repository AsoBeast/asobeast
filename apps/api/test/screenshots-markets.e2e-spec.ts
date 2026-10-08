import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  AppDetail,
  ChangeEventItem,
  ChangeTimeline,
  SnapshotDiffResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { OCR_ENGINE } from '../src/screenshots/ocr-engine';
import { ScreenshotImageSource } from '../src/store-providers/screenshot-image.source';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
} from './helpers/screenshot-store';
import { lines, readsFinished, solidPng } from './helpers/screenshot-reading';
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
});
