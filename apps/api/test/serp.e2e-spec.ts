import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, SerpSnapshot } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const DATE = new Date('2026-07-01T00:00:00.000Z');

describe('SerpController (e2e)', () => {
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

  it('returns a 404 envelope for an unknown keyword id', async () => {
    const response = await api.get('/keywords/missing/serp').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/keywords/missing/serp');
    expect(typeof body.message).toBe('string');
  });

  it('returns the latest snapshot with annotated entries', async () => {
    const you = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'self-store',
        country: 'us',
        name: 'You',
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'rival-store',
        country: 'us',
        name: 'Rival',
        isCompetitor: true,
        primaryAppId: you.id,
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: { appId: you.id, keywordId: keyword.id, source: 'MANUAL' },
    });
    await prisma.serpEntry.createMany({
      data: [
        {
          keywordId: keyword.id,
          date: DATE,
          position: 1,
          storeAppId: 'self-store',
          title: 'You',
        },
        {
          keywordId: keyword.id,
          date: DATE,
          position: 2,
          storeAppId: 'rival-store',
          title: 'Rival',
        },
        {
          keywordId: keyword.id,
          date: DATE,
          position: 3,
          storeAppId: 'other-store',
          title: 'Other',
        },
      ],
    });

    const response = await api.get(`/keywords/${keyword.id}/serp`).expect(200);

    const body = response.body as SerpSnapshot;
    expect(body.date).toBe('2026-07-01');
    expect(body.entries).toHaveLength(3);
    expect(body.entries[0]).toMatchObject({
      appId: you.id,
      isCompetitor: false,
    });
    expect(body.entries[1].isCompetitor).toBe(true);
    expect(body.entries[2]).toMatchObject({ appId: null, isCompetitor: false });
  });
});
