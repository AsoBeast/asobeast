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
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
} from './helpers/screenshot-store';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Screenshot change events (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const registry = new FakeScreenshotRegistry();

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

  const importApp = async () =>
    (
      (await api.post('/apps').send({ url: APP_STORE_URL }).expect(201))
        .body as AppDetail
    ).id;

  const screenshotEvents = async (
    appId: string,
  ): Promise<ChangeEventItem[]> => {
    const { events } = (await api.get(`/apps/${appId}/changes`).expect(200))
      .body as ChangeTimeline;
    return events.filter((event) => event.field.startsWith('screenshot'));
  };

  const refreshedChanges = async (appId: string) =>
    (
      (await api.post(`/apps/${appId}/refresh`).expect(200))
        .body as SnapshotDiffResult
    ).changes;

  it('reports a replaced screenshot as one screenshot images event', async () => {
    const appId = await importApp();
    registry.screenshots = [appleShot(1), appleShot(9), appleShot(3)];

    await expect(refreshedChanges(appId)).resolves.toEqual([
      {
        field: 'screenshotImages',
        before: '3 screenshots',
        after: '3 screenshots, 1 replaced',
      },
    ]);

    const events = await screenshotEvents(appId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      field: 'screenshotImages',
      before: '3 screenshots',
      after: '3 screenshots, 1 replaced',
      detail: { kind: 'images', added: [2], removed: [2], reordered: false },
    });
  });

  it('reports a swap as one screenshot images event that says it was reordered', async () => {
    const appId = await importApp();
    registry.screenshots = [appleShot(3), appleShot(2), appleShot(1)];

    await expect(refreshedChanges(appId)).resolves.toEqual([
      {
        field: 'screenshotImages',
        before: '3 screenshots',
        after: '3 screenshots, reordered',
      },
    ]);

    const events = await screenshotEvents(appId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      field: 'screenshotImages',
      after: '3 screenshots, reordered',
      detail: { kind: 'images', added: [], removed: [], reordered: true },
    });
  });

  it('keeps the numeric count event when a screenshot is added and attaches the detail', async () => {
    const appId = await importApp();
    registry.screenshots = [1, 2, 3, 4].map(appleShot);

    await expect(refreshedChanges(appId)).resolves.toEqual([
      { field: 'screenshots', before: '3', after: '4' },
    ]);

    const events = await screenshotEvents(appId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      field: 'screenshots',
      before: '3',
      after: '4',
      detail: { kind: 'images', added: [4], removed: [] },
    });
  });

  it('reports nothing when the list is identical', async () => {
    const appId = await importApp();

    await expect(refreshedChanges(appId)).resolves.toEqual([]);

    await expect(screenshotEvents(appId)).resolves.toEqual([]);
  });

  it('returns a stored detail on the timeline and no detail key on an event without one', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    const rival = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    const detail = { kind: 'captions', added: ['B'], removed: ['A'] };
    await prisma.changeEvent.createMany({
      data: [
        {
          appId: rival.id,
          field: 'screenshotCaptions',
          before: 'A',
          after: 'B',
          detail,
          capturedAt: addDays(utcToday(), -1),
        },
        {
          appId: primary.id,
          field: 'title',
          before: 'x',
          after: 'y',
          capturedAt: addDays(utcToday(), -2),
        },
      ],
    });

    const { events } = (
      await api.get(`/apps/${primary.id}/changes`).expect(200)
    ).body as ChangeTimeline;

    expect(events[0]).toMatchObject({
      field: 'screenshotCaptions',
      isCompetitor: true,
      detail,
    });
    expect('detail' in events[1]).toBe(false);
  });
});
