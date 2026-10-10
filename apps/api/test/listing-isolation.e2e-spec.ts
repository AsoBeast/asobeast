import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  AppDetail,
  AppListItem,
  ChangeTimeline,
  CompetitorItem,
  FirstRunStatus,
  MetadataAuditResult,
  PortfolioSummary,
  RatingsHistory,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const D0 = addDays(utcToday(), -10);
const D1 = addDays(utcToday(), -9);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

describe('home listing reads (e2e)', () => {
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

  const listing = (
    appId: string,
    country: string | null,
    title: string,
    ratingAvg: number,
    capturedAt: Date,
  ) => ({
    appId,
    country,
    title,
    subtitle: `${title} subtitle`,
    description: `${title} description`,
    ratingAvg,
    ratingCount: 10,
    raw: {},
    capturedAt,
  });

  const seed = async () => {
    const mine = await prisma.app.create({
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
        primaryAppId: mine.id,
      },
    });
    await prisma.appSnapshot.createMany({
      data: [
        listing(mine.id, null, 'Habit Tracker', 4.5, D0),
        listing(mine.id, 'de', 'Gewohnheits Tracker', 3, D1),
        listing(rival.id, null, 'Rival Home', 4, D0),
        listing(rival.id, 'de', 'Rival Deutsch', 2, D1),
      ],
    });
    await prisma.changeEvent.createMany({
      data: [
        {
          appId: mine.id,
          field: 'title',
          before: 'A',
          after: 'home change',
          capturedAt: D0,
        },
        {
          appId: mine.id,
          country: 'de',
          field: 'title',
          before: 'C',
          after: 'market change',
          capturedAt: D1,
        },
      ],
    });
    return { mine, rival };
  };

  it('answers an app detail from the home listing', async () => {
    const { mine } = await seed();

    const response = await api.get(`/apps/${mine.id}`).expect(200);

    const body = response.body as AppDetail;
    expect(body.latestSnapshot?.title).toBe('Habit Tracker');
    expect(body.competitors[0].latestSnapshot?.title).toBe('Rival Home');
  });

  it('answers the app list from the home listing', async () => {
    const { mine } = await seed();

    const response = await api.get('/apps').expect(200);

    const item = (response.body as AppListItem[]).find(
      (row) => row.id === mine.id,
    );
    expect(item?.ratingAvg).toBe(4.5);
  });

  it('audits the home listing', async () => {
    const { mine } = await seed();

    const response = await api
      .get(`/apps/${mine.id}/metadata/audit`)
      .expect(200);

    const body = response.body as MetadataAuditResult;
    expect(body.fields.find((field) => field.field === 'title')?.value).toBe(
      'Habit Tracker',
    );
  });

  it('charts the ratings of the home listing only', async () => {
    const { mine } = await seed();

    const response = await api
      .get(
        `/apps/${mine.id}/ratings-history?from=${isoDay(addDays(D0, -5))}&to=${isoDay(addDays(D1, 1))}`,
      )
      .expect(200);

    const body = response.body as RatingsHistory;
    expect(body.points.map((point) => point.ratingAvg)).toEqual([4.5]);
  });

  it('lists the competitors with their home listing', async () => {
    const { mine } = await seed();

    const response = await api.get(`/apps/${mine.id}/competitors`).expect(200);

    const body = response.body as CompetitorItem[];
    expect(body.map((item) => item.latestSnapshot?.title)).toEqual([
      'Rival Home',
    ]);
  });

  it('lists home changes only', async () => {
    const { mine } = await seed();

    const timeline = await api.get(`/apps/${mine.id}/changes`).expect(200);
    const recent = await api.get('/changes/recent').expect(200);

    for (const body of [timeline.body, recent.body] as ChangeTimeline[]) {
      expect(body.events.map((event) => event.after)).toEqual(['home change']);
    }
  });

  it('keeps the first run and the portfolio on the home listing', async () => {
    const { mine } = await seed();

    const firstRun = await api.get(`/apps/${mine.id}/first-run`).expect(200);
    const portfolio = await api.get('/portfolio').expect(200);

    const metadata = (firstRun.body as FirstRunStatus).stages.find(
      (stage) => stage.stage === 'metadata',
    );
    expect(metadata?.ready).toBe(1);
    const item = (portfolio.body as PortfolioSummary).apps.find(
      (row) => row.id === mine.id,
    );
    expect(item?.lastCapturedAt).toBe(D0.toISOString());
  });
});
