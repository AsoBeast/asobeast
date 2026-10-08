import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppDetail } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  appleKey,
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
  GOOGLE_PLAY_URL,
} from './helpers/screenshot-store';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('Recording screenshots (e2e)', () => {
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
      'TRUNCATE TABLE "App", "Keyword", "AppGroup", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('records the screenshots of an imported app as pending, in store order', async () => {
    const response = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const { latestSnapshot } = response.body as AppDetail;

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshotId: latestSnapshot?.id },
      orderBy: { position: 'asc' },
    });

    expect(rows.map((row) => [row.position, row.status, row.assetKey])).toEqual(
      [
        [1, 'pending', appleKey(1)],
        [2, 'pending', appleKey(2)],
        [3, 'pending', appleKey(3)],
      ],
    );
    expect(rows.every((row) => row.workspaceId === DEFAULT_WORKSPACE_ID)).toBe(
      true,
    );
  });

  it('records a fresh set for the new snapshot on every refresh', async () => {
    const imported = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const appId = (imported.body as AppDetail).id;
    registry.screenshots = [appleShot(3), appleShot(1)];

    await api.post(`/apps/${appId}/refresh`).expect(200);

    const latest = await prisma.appSnapshot.findFirst({
      where: { appId },
      orderBy: { capturedAt: 'desc' },
      include: { screenshots: { orderBy: { position: 'asc' } } },
    });
    expect(latest?.screenshots.map((row) => row.assetKey)).toEqual([
      appleKey(3),
      appleKey(1),
    ]);
    await expect(prisma.snapshotScreenshot.count()).resolves.toBe(5);
  });

  it('records google play screenshots as skipped with the size suffix stripped', async () => {
    await api.post('/apps').send({ url: GOOGLE_PLAY_URL }).expect(201);

    const rows = await prisma.snapshotScreenshot.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'skipped',
      assetKey: 'https://play-lh.googleusercontent.com/AbC',
    });
  });

  it('records nothing for a listing without screenshots', async () => {
    registry.screenshots = [];

    await api.post('/apps').send({ url: APP_STORE_URL }).expect(201);

    await expect(prisma.snapshotScreenshot.count()).resolves.toBe(0);
  });
});
