import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppDetail } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { OCR_ENGINE } from '../src/screenshots/ocr-engine';
import { ScreenshotQueue } from '../src/screenshots/screenshot-queue';
import { ScreenshotFetchError } from '../src/store-providers/errors';
import { ScreenshotImageSource } from '../src/store-providers/screenshot-image.source';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  apple,
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
} from './helpers/screenshot-store';
import { lines, readsFinished, solidPng } from './helpers/screenshot-reading';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_screenshots_other';

describe('Reading screenshots (e2e)', () => {
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
    read.mockReset().mockResolvedValue(await solidPng());
    engineRead.mockReset().mockResolvedValue(lines('Track every habit'));
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "AppGroup", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const importApp = async () => {
    const imported = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    return (imported.body as AppDetail).latestSnapshot?.id as string;
  };

  it('reads every pending screenshot of an imported app and stores the caption', async () => {
    const snapshotId = await importApp();

    await readsFinished(app, prisma, snapshotId);

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshotId },
      orderBy: { position: 'asc' },
    });
    expect(rows.map((row) => [row.status, row.caption, row.recipe])).toEqual([
      ['read', 'Track every habit', 'ocr1:eng'],
      ['read', 'Track every habit', 'ocr1:eng'],
      ['read', 'Track every habit', 'ocr1:eng'],
    ]);
    await expect(prisma.screenshotText.count()).resolves.toBe(3);
    expect(engineRead).toHaveBeenCalledTimes(3);
  });

  it('reads an image once for two workspaces', async () => {
    await readsFinished(app, prisma, await importApp());
    expect(engineRead).toHaveBeenCalledTimes(3);

    await prisma.workspace.create({
      data: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    const other = await prisma.app.create({
      data: {
        workspaceId: OTHER_WORKSPACE,
        store: Store.APP_STORE,
        storeAppId: '999',
        country: 'us',
        name: 'Neighbour',
      },
    });
    const snapshot = await prisma.appSnapshot.create({
      data: { appId: other.id, title: 'Neighbour', description: 'd', raw: {} },
    });
    await prisma.snapshotScreenshot.create({
      data: {
        snapshotId: snapshot.id,
        workspaceId: OTHER_WORKSPACE,
        position: 1,
        url: appleShot(1),
        assetKey: apple(1),
      },
    });

    await asWorkspace(
      app,
      () => app.get(ScreenshotQueue).request(other.id, snapshot.id),
      OTHER_WORKSPACE,
    );
    await readsFinished(app, prisma, snapshot.id);

    expect(engineRead).toHaveBeenCalledTimes(3);
    await expect(
      prisma.snapshotScreenshot.findUnique({
        where: {
          snapshotId_position: { snapshotId: snapshot.id, position: 1 },
        },
      }),
    ).resolves.toMatchObject({ status: 'read', caption: 'Track every habit' });
  });

  it('marks a screenshot the cdn no longer serves as failed and reads the others', async () => {
    const png = await solidPng();
    read
      .mockResolvedValueOnce(png)
      .mockRejectedValueOnce(
        new ScreenshotFetchError('the image request answered 404', false),
      )
      .mockResolvedValueOnce(png);

    const snapshotId = await importApp();
    await readsFinished(app, prisma, snapshotId);

    const rows = await prisma.snapshotScreenshot.findMany({
      where: { snapshotId },
      orderBy: { position: 'asc' },
    });
    expect(rows.map((row) => row.status)).toEqual(['read', 'failed', 'read']);
  });
});
