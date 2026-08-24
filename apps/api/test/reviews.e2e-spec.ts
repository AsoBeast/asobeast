import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  RatingsHistogram,
  ReviewList,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

describe('ReviewsController (e2e)', () => {
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

  const seedApp = async () => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    await prisma.review.createMany({
      data: [
        {
          appId: created.id,
          reviewId: 'r1',
          score: 5,
          text: 'Love it',
          version: '2.0.0',
          reviewedAt: new Date('2026-07-10T00:00:00Z'),
        },
        {
          appId: created.id,
          reviewId: 'r2',
          score: 1,
          text: 'Broken',
          version: '1.0.0',
          reviewedAt: new Date('2026-07-11T00:00:00Z'),
        },
        {
          appId: created.id,
          reviewId: 'r3',
          score: 1,
          text: 'Crashes',
          version: '2.0.0',
          reviewedAt: new Date('2026-07-12T00:00:00Z'),
        },
      ],
    });
    return created;
  };

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await api.get('/apps/missing/reviews').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/reviews');
    expect(typeof body.message).toBe('string');
  });

  it('lists reviews newest first with the version facet', async () => {
    const seeded = await seedApp();

    const response = await api.get(`/apps/${seeded.id}/reviews`).expect(200);

    const body = response.body as ReviewList;
    expect(body.total).toBe(3);
    expect(body.reviews.map((review) => review.reviewId)).toEqual([
      'r3',
      'r2',
      'r1',
    ]);
    expect(body.versions).toEqual(['2.0.0', '1.0.0']);
  });

  it('filters by star and version', async () => {
    const seeded = await seedApp();

    const response = await api
      .get(`/apps/${seeded.id}/reviews`)
      .query({ score: 1, version: '2.0.0' })
      .expect(200);

    const body = response.body as ReviewList;
    expect(body.total).toBe(1);
    expect(body.reviews.map((review) => review.reviewId)).toEqual(['r3']);
  });

  const seedSnapshot = async (store: Store, raw: object) => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: store === Store.GOOGLE_PLAY ? 'com.example.app' : '222',
        country: 'us',
        name: 'Snapshotted',
      },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Snapshotted',
        description: 'desc',
        raw,
      },
    });
    return created;
  };

  it('reports the ratings distribution for a Play app', async () => {
    const seeded = await seedSnapshot(Store.GOOGLE_PLAY, {
      histogram: { '1': 10, '2': 20, '3': 30, '4': 40, '5': 100 },
    });

    const response = await api
      .get(`/apps/${seeded.id}/reviews/histogram`)
      .expect(200);

    const body = response.body as RatingsHistogram;
    expect(body.available).toBe(true);
    expect(body.counts).toEqual({
      '1': 10,
      '2': 20,
      '3': 30,
      '4': 40,
      '5': 100,
    });
    expect(body.total).toBe(200);
    expect(body.capturedAt).not.toBeNull();
  });

  it('reports no histogram for an App Store app', async () => {
    const seeded = await seedSnapshot(Store.APP_STORE, {
      histogram: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1 },
    });

    const response = await api
      .get(`/apps/${seeded.id}/reviews/histogram`)
      .expect(200);

    expect(response.body as RatingsHistogram).toEqual({
      available: false,
      counts: null,
      total: null,
      capturedAt: null,
    });
  });
});
