import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, AppDetail, AppScreenshots } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { ownerAgent, useCookies } from './helpers/session';
import {
  appleShot,
  APP_STORE_URL,
  FakeScreenshotRegistry,
  GOOGLE_PLAY_URL,
  PLAY_SHOT,
} from './helpers/screenshot-store';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_screenshots_api_other';

describe('GET /apps/:id/screenshots (e2e)', () => {
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
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: OTHER_WORKSPACE } });
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('answers a 404 envelope for an unknown app', async () => {
    const response = await api.get('/apps/missing/screenshots').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/screenshots');
  });

  it('lists the screenshots of an imported app in store order, still pending', async () => {
    const imported = await api
      .post('/apps')
      .send({ url: APP_STORE_URL })
      .expect(201);
    const detail = imported.body as AppDetail;

    const response = await api
      .get(`/apps/${detail.id}/screenshots`)
      .expect(200);

    const body = response.body as AppScreenshots;
    expect(body).toMatchObject({
      appId: detail.id,
      store: 'APP_STORE',
      snapshotId: detail.latestSnapshot?.id,
      reading: 'on',
    });
    expect(body.screenshots).toEqual(
      [1, 2, 3].map((position) => ({
        position,
        url: appleShot(position),
        caption: null,
        status: 'pending',
      })),
    );
  });

  it('reports a google play app as unsupported with its screenshots skipped', async () => {
    const imported = await api
      .post('/apps')
      .send({ url: GOOGLE_PLAY_URL })
      .expect(201);

    const response = await api
      .get(`/apps/${(imported.body as AppDetail).id}/screenshots`)
      .expect(200);

    const body = response.body as AppScreenshots;
    expect(body.reading).toBe('unsupported');
    expect(body.screenshots).toEqual([
      { position: 1, url: PLAY_SHOT, caption: null, status: 'skipped' },
    ]);
  });

  it('answers 404 for an app that belongs to another workspace', async () => {
    await prisma.workspace.create({
      data: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    const other = await prisma.app.create({
      data: {
        workspaceId: OTHER_WORKSPACE,
        store: Store.APP_STORE,
        storeAppId: '777',
        country: 'us',
        name: 'Neighbour',
      },
    });

    await api.get(`/apps/${other.id}/screenshots`).expect(404);
  });
});
