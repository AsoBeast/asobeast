import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ApiErrorEnvelope, ChangeTimeline } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
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
    await settleBootRegistration(app);

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
          capturedAt: addDays(utcToday(), -3),
        },
        {
          appId: competitor.id,
          field: 'subtitle',
          before: 'Old',
          after: 'New',
          capturedAt: addDays(utcToday(), -2),
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
          capturedAt: addDays(utcToday(), -3),
        },
        {
          appId: primary.id,
          field: 'subtitle',
          before: 'Old',
          after: 'New',
          capturedAt: addDays(utcToday(), -2),
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

  describe('the currency of a price change', () => {
    const createApps = async () => {
      const mine = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '111',
          country: 'jp',
          name: 'Mine',
        },
      });
      const rival = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '222',
          country: 'pl',
          name: 'Rival',
          isCompetitor: true,
          primaryAppId: mine.id,
        },
      });
      return { mine, rival };
    };

    const listing = (appId: string, raw: object, daysAgo: number) => ({
      appId,
      country: null,
      title: 'Listing',
      description: 'Listing description',
      raw,
      capturedAt: addDays(utcToday(), -daysAgo),
    });

    const priceEvent = (appId: string, after: string, daysAgo: number) => ({
      appId,
      field: 'price',
      before: '0',
      after,
      capturedAt: addDays(utcToday(), -daysAgo),
    });

    it('names the storefront currency of each price change, newest listing first', async () => {
      const { mine, rival } = await createApps();
      await prisma.appSnapshot.createMany({
        data: [
          listing(mine.id, { currency: 'USD' }, 20),
          listing(mine.id, { currency: 'JPY' }, 1),
          listing(rival.id, { currency: 'PLN' }, 1),
        ],
      });
      await prisma.changeEvent.createMany({
        data: [
          priceEvent(rival.id, '4.99', 2),
          priceEvent(mine.id, '500', 3),
          {
            appId: mine.id,
            field: 'title',
            before: 'A',
            after: 'B',
            capturedAt: addDays(utcToday(), -4),
          },
        ],
      });

      const timeline = await api.get(`/apps/${mine.id}/changes`).expect(200);
      const recent = await api.get('/changes/recent').expect(200);

      for (const response of [timeline, recent]) {
        const events = (response.body as ChangeTimeline).events;
        expect(events.map((event) => [event.field, event.currency])).toEqual([
          ['price', 'PLN'],
          ['price', 'JPY'],
          ['title', undefined],
        ]);
        expect(events[2]).not.toHaveProperty('currency');
      }
    });

    it('answers a null currency for a listing without one and for no listing', async () => {
      const { mine, rival } = await createApps();
      await prisma.appSnapshot.createMany({
        data: [listing(mine.id, {}, 1)],
      });
      await prisma.changeEvent.createMany({
        data: [priceEvent(rival.id, '4.99', 2), priceEvent(mine.id, '500', 3)],
      });

      const response = await api.get(`/apps/${mine.id}/changes`).expect(200);

      expect(
        (response.body as ChangeTimeline).events.map((event) => event.currency),
      ).toEqual([null, null]);
    });
  });
});
