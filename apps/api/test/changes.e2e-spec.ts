import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, ChangeTimeline } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

describe('ChangesController (e2e)', () => {
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
    const response = await api.get('/apps/missing/changes').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/changes');
    expect(typeof body.message).toBe('string');
  });

  it('merges own and competitor events, newest first', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    const competitor = await prisma.app.create({
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
    await prisma.changeEvent.createMany({
      data: [
        {
          appId: primary.id,
          field: 'title',
          before: 'A',
          after: 'B',
          capturedAt: new Date('2026-07-09T00:00:00Z'),
        },
        {
          appId: competitor.id,
          field: 'subtitle',
          before: 'Old',
          after: 'New',
          capturedAt: new Date('2026-07-10T00:00:00Z'),
        },
      ],
    });

    const response = await api.get(`/apps/${primary.id}/changes`).expect(200);

    const body = response.body as ChangeTimeline;
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({
      field: 'subtitle',
      isCompetitor: true,
      appName: 'Rival',
    });
    expect(body.events[1]).toMatchObject({
      field: 'title',
      isCompetitor: false,
      appName: 'Mine',
    });
  });

  it('lists recent workspace changes newest first within the limit', async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });
    await prisma.changeEvent.createMany({
      data: [
        {
          appId: primary.id,
          field: 'title',
          before: 'A',
          after: 'B',
          capturedAt: new Date('2026-07-09T00:00:00Z'),
        },
        {
          appId: primary.id,
          field: 'subtitle',
          before: 'Old',
          after: 'New',
          capturedAt: new Date('2026-07-10T00:00:00Z'),
        },
      ],
    });

    const response = await api
      .get('/changes/recent')
      .query({ limit: 1 })
      .expect(200);

    const body = response.body as ChangeTimeline;
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      field: 'subtitle',
      appName: 'Mine',
      isCompetitor: false,
    });
  });
});
