import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  AppSetupState,
  SETUP_MARKETS_MAX,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppSetupService } from '../src/apps/app-setup.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { seedApiToken, seedWorkspace } from './helpers/api-tokens';
import {
  ENGLISH,
  LocalizedRegistry,
  US_APP_URL,
} from './helpers/localized-store';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_setup_other';

describe('App setup (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  let readToken: string;
  let writeToken: string;
  let otherToken: string;
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
    await seedWorkspace(prisma, DEFAULT_WORKSPACE_ID, 'Default');
    await seedWorkspace(prisma, OTHER_WORKSPACE, 'Other');
    api = await ownerAgent(app);
    readToken = await seedApiToken(prisma, {
      seed: 'setupread',
      email: 'setup-reader@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
    });
    writeToken = await seedApiToken(prisma, {
      seed: 'setupwrite',
      email: 'setup-writer@example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
      scope: 'write',
    });
    otherToken = await seedApiToken(prisma, {
      seed: 'setupother',
      email: 'setup-other@example.com',
      workspaceId: OTHER_WORKSPACE,
      role: 'owner',
      scope: 'write',
    });
  });

  beforeEach(async () => {
    registry.reset();
    registry.listings.set('us', ENGLISH);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const STORE_APP_ID: Record<Store, string> = {
    APP_STORE: '555000111',
    GOOGLE_PLAY: 'com.example.setup',
  };

  const createApp = (
    primaryAppId?: string,
    overrides: { store?: Store; country?: string } = {},
  ) => {
    const store = overrides.store ?? Store.APP_STORE;
    return prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: primaryAppId ? '555000999' : STORE_APP_ID[store],
        country: overrides.country ?? 'us',
        name: primaryAppId ? 'Rival' : 'Setup Fixture',
        isCompetitor: primaryAppId !== undefined,
        primaryAppId,
      },
    });
  };

  const readSetup = async (appId: string) =>
    (await api.get(`/apps/${appId}/setup`).expect(200)).body as AppSetupState;

  const patchSetup = async (appId: string, body: object) =>
    (await api.patch(`/apps/${appId}/setup`).send(body).expect(200))
      .body as AppSetupState;

  it('answers the default for a primary app without a row', async () => {
    const { id } = await createApp();

    await expect(readSetup(id)).resolves.toEqual({
      appId: id,
      status: 'not_started',
      skipped: [],
      countriesReviewed: false,
      selectedMarkets: ['us'],
      completedAt: null,
      updatedAt: null,
    });
  });

  it('starts the setup at import and never resets it on a second import', async () => {
    const imported = (
      await api.post('/apps').send({ url: US_APP_URL }).expect(201)
    ).body as AppDetail;

    const started = await readSetup(imported.id);
    expect(started).toMatchObject({
      appId: imported.id,
      status: 'in_progress',
      skipped: [],
      countriesReviewed: false,
      selectedMarkets: ['us'],
      completedAt: null,
    });
    expect(typeof started.updatedAt).toBe('string');

    await patchSetup(imported.id, { skipped: ['keywords'] });
    await api.post('/apps').send({ url: US_APP_URL }).expect(201);

    await expect(readSetup(imported.id)).resolves.toMatchObject({
      status: 'in_progress',
      skipped: ['keywords'],
    });
  });

  it('still imports the app when its setup cannot be started', async () => {
    jest
      .spyOn(app.get(AppSetupService), 'begin')
      .mockRejectedValueOnce(new Error('database unreachable'));

    const imported = (
      await api.post('/apps').send({ url: US_APP_URL }).expect(201)
    ).body as AppDetail;

    await expect(readSetup(imported.id)).resolves.toMatchObject({
      status: 'not_started',
      updatedAt: null,
    });
  });

  it('keeps the first completion time and clears it when restarted from a dismissal', async () => {
    const { id } = await createApp();
    await patchSetup(id, { status: 'in_progress' });

    const first = await patchSetup(id, { status: 'completed' });
    const again = await patchSetup(id, { status: 'completed' });
    expect(again.completedAt).toBe(first.completedAt);

    await patchSetup(id, { status: 'dismissed' });
    await expect(
      patchSetup(id, { status: 'in_progress' }),
    ).resolves.toMatchObject({ status: 'in_progress', completedAt: null });
  });

  it('patches one field and keeps the rest', async () => {
    const { id } = await createApp();

    await expect(
      patchSetup(id, { status: 'in_progress', skipped: ['keywords'] }),
    ).resolves.toMatchObject({
      status: 'in_progress',
      skipped: ['keywords'],
      countriesReviewed: false,
      selectedMarkets: ['us'],
    });
    await expect(
      patchSetup(id, {
        countriesReviewed: true,
        selectedMarkets: ['de', 'us'],
      }),
    ).resolves.toMatchObject({
      skipped: ['keywords'],
      countriesReviewed: true,
      selectedMarkets: ['de', 'us'],
    });
    await expect(readSetup(id)).resolves.toMatchObject({
      status: 'in_progress',
      skipped: ['keywords'],
      countriesReviewed: true,
      selectedMarkets: ['de', 'us'],
    });
  });

  it('refuses a selected market that is not a storefront and keeps the stored setup', async () => {
    const { id } = await createApp();
    const before = await patchSetup(id, { status: 'in_progress' });

    const response = await api
      .patch(`/apps/${id}/setup`)
      .send({ status: 'completed', selectedMarkets: ['pl', 'zz', 'xx'] })
      .expect(400);

    expect((response.body as ApiErrorEnvelope).message).toBe(
      'zz is not an App Store storefront',
    );
    await expect(readSetup(id)).resolves.toEqual(before);
  });

  it.each([
    [Store.APP_STORE, 'ad', 'ad is not an App Store storefront'],
    [Store.GOOGLE_PLAY, 'pw', 'pw is not a Google Play location'],
  ])(
    'judges the markets of a %s app against its own store',
    async (store, market, message) => {
      const { id } = await createApp(undefined, { store });

      const response = await api
        .patch(`/apps/${id}/setup`)
        .send({ selectedMarkets: ['us', market] })
        .expect(400);

      expect((response.body as ApiErrorEnvelope).message).toBe(message);
    },
  );

  it('accepts a storefront of the store the app is in', async () => {
    const { id } = await createApp(undefined, { store: Store.GOOGLE_PLAY });

    await expect(
      patchSetup(id, { selectedMarkets: ['ad', 'us'] }),
    ).resolves.toMatchObject({ selectedMarkets: ['ad', 'us'] });
  });

  it('lets a client send back a list that holds a code stored before the check', async () => {
    const { id } = await createApp();
    await patchSetup(id, { status: 'in_progress' });
    await prisma.appSetup.update({
      where: { appId: id },
      data: { selectedMarkets: ['us', 'zz'] },
    });

    await expect(
      patchSetup(id, { selectedMarkets: ['de', 'us', 'zz'] }),
    ).resolves.toMatchObject({ selectedMarkets: ['de', 'us', 'zz'] });
    await api
      .patch(`/apps/${id}/setup`)
      .send({ selectedMarkets: ['us', 'xx'] })
      .expect(400);
  });

  it('always accepts the home market of the app', async () => {
    const { id } = await createApp(undefined, { country: 'zz' });

    await expect(
      patchSetup(id, { selectedMarkets: ['zz'] }),
    ).resolves.toMatchObject({ selectedMarkets: ['zz'] });
  });

  it('completes and restarts', async () => {
    const { id } = await createApp();
    await patchSetup(id, { status: 'in_progress' });

    const completed = await patchSetup(id, { status: 'completed' });
    expect(completed.status).toBe('completed');
    expect(typeof completed.completedAt).toBe('string');

    await expect(
      patchSetup(id, {
        status: 'in_progress',
        skipped: [],
        countriesReviewed: false,
      }),
    ).resolves.toMatchObject({
      status: 'in_progress',
      skipped: [],
      countriesReviewed: false,
      completedAt: null,
    });
  });

  it('dismisses', async () => {
    const { id } = await createApp();

    await expect(
      patchSetup(id, { status: 'dismissed' }),
    ).resolves.toMatchObject({ status: 'dismissed', completedAt: null });
  });

  it.each([
    [{ status: 'later' }],
    [{ status: null }],
    [{ skipped: ['alerts'] }],
    [{ skipped: ['keywords', 'keywords'] }],
    [{ selectedMarkets: ['usa'] }],
    [{ selectedMarkets: [] }],
    [
      {
        selectedMarkets: Array.from(
          { length: SETUP_MARKETS_MAX + 1 },
          (_, index) =>
            String.fromCharCode(97 + Math.floor(index / 26), 97 + (index % 26)),
        ),
      },
    ],
    [{ completedAt: '2026-10-14T00:00:00.000Z' }],
  ])('refuses %j with 400 and writes nothing', async (body) => {
    const { id } = await createApp();

    await api.patch(`/apps/${id}/setup`).send(body).expect(400);

    await expect(prisma.appSetup.count()).resolves.toBe(0);
  });

  it('answers an empty body with the row unchanged', async () => {
    const { id } = await createApp();
    const before = await patchSetup(id, { status: 'in_progress' });

    await expect(patchSetup(id, {})).resolves.toEqual(before);
  });

  it('answers 404 for a competitor, an unknown app and another workspace', async () => {
    const primary = await createApp();
    const competitor = await createApp(primary.id);

    await api.get(`/apps/${competitor.id}/setup`).expect(404);
    await api
      .patch(`/apps/${competitor.id}/setup`)
      .send({ status: 'dismissed' })
      .expect(404);
    await api.get('/apps/no-such-app/setup').expect(404);
    await request(app.getHttpServer())
      .get(`/apps/${primary.id}/setup`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/apps/${primary.id}/setup`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'dismissed' })
      .expect(404);
    await expect(prisma.appSetup.count()).resolves.toBe(0);
  });

  it('lets a read token read and refuses it the write', async () => {
    const { id } = await createApp();

    await request(app.getHttpServer())
      .get(`/apps/${id}/setup`)
      .set('Authorization', `Bearer ${readToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/apps/${id}/setup`)
      .set('Authorization', `Bearer ${readToken}`)
      .send({ status: 'dismissed' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/apps/${id}/setup`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ status: 'dismissed' })
      .expect(200);
  });

  it('lets every member of the workspace continue the same setup', async () => {
    const { id } = await createApp();
    await patchSetup(id, { status: 'in_progress', skipped: ['competitors'] });

    const seen = await request(app.getHttpServer())
      .get(`/apps/${id}/setup`)
      .set('Authorization', `Bearer ${writeToken}`)
      .expect(200);

    expect((seen.body as AppSetupState).skipped).toEqual(['competitors']);
  });
});
