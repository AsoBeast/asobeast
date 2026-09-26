import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, CategoryRankSeries } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

describe('CategoryRanksController (e2e)', () => {
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
    }).compile();

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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await api.get('/apps/missing/category-ranks').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/category-ranks');
    expect(typeof body.message).toBe('string');
  });

  it('groups category rank history by collection and genre', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
        snapshots: {
          create: {
            title: 'You',
            description: 'desc',
            raw: {
              primaryGenreId: 6007,
              primaryGenre: 'Productivity',
              price: 0,
            },
          },
        },
      },
    });
    await prisma.categoryRank.createMany({
      data: [
        {
          appId: you.id,
          date: addDays(utcToday(), -2),
          collection: 'free',
          genre: '6007',
          position: 12,
        },
        {
          appId: you.id,
          date: addDays(utcToday(), -1),
          collection: 'free',
          genre: '6007',
          position: 8,
        },
        {
          appId: you.id,
          date: addDays(utcToday(), -1),
          collection: 'free',
          genre: 'overall',
          position: null,
        },
      ],
    });

    const response = await api
      .get(`/apps/${you.id}/category-ranks`)
      .expect(200);

    const body = response.body as CategoryRankSeries;
    expect(body.series).toHaveLength(2);
    const category = body.series.find((item) => item.genre === '6007');
    expect(category).toMatchObject({
      collection: 'free',
      genreName: 'Productivity',
      current: 8,
    });
    expect(category?.points).toHaveLength(2);
    const overall = body.series.find((item) => item.genre === 'overall');
    expect(overall).toMatchObject({ genreName: 'Overall', current: null });
  });

  it.each([
    ['a start that is not on the calendar', { from: '2026-09-31' }],
    ['an end before the start', { from: '2026-09-15', to: '2026-09-01' }],
  ])('refuses a history window with %s', async (_case, query) => {
    const app = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'window-store',
        country: 'us',
        name: 'Window',
      },
    });

    await api.get(`/apps/${app.id}/category-ranks`).query(query).expect(400);
  });
});
