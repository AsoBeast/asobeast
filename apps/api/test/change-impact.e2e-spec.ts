import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  ChangeImpactReport,
  CURRENT_FORMULA_VERSIONS,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  addDays,
  toDateKey,
  utcToday,
} from '../src/analytics/analytics.support';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

const HOUR_MS = 60 * 60 * 1000;
const TODAY = utcToday();
const CHANGED = addDays(TODAY, -20);
const on = (offset: number): Date => addDays(CHANGED, offset);
const at = (offset: number, hour: number): Date =>
  new Date(on(offset).getTime() + hour * HOUR_MS);

interface SeededKeyword {
  text: string;
  country: string;
  active: boolean;
  traffic: Array<[number, number]>;
  ranks: Array<[number, number | null]>;
}

const KEYWORDS: SeededKeyword[] = [
  {
    text: 'focus timer',
    country: 'us',
    active: true,
    traffic: [
      [-10, 8],
      [3, 1],
    ],
    ranks: [
      [-1, 10],
      [7, 4],
      [13, 3],
    ],
  },
  {
    text: 'pomodoro',
    country: 'us',
    active: true,
    traffic: [
      [-10, 4],
      [3, 9],
    ],
    ranks: [
      [-1, 5],
      [7, 9],
      [13, 5],
    ],
  },
  {
    text: 'study timer',
    country: 'us',
    active: true,
    traffic: [[-10, 2]],
    ranks: [
      [-1, null],
      [7, 30],
      [13, null],
    ],
  },
  {
    text: 'deep work',
    country: 'us',
    active: false,
    traffic: [[-10, 9]],
    ranks: [
      [-1, 1],
      [7, 50],
      [13, 50],
    ],
  },
  {
    text: 'focus timer',
    country: 'gb',
    active: true,
    traffic: [],
    ranks: [
      [-1, 20],
      [7, 12],
      [13, 25],
    ],
  },
];

const pendingWindow = (days: number) => ({
  days,
  status: 'pending',
  targetDate: toDateKey(on(days)),
  measuredOn: null,
  movement: null,
  medianPositionChange: null,
  visibilityBefore: null,
  visibilityAfter: null,
  visibilityChange: null,
  overlappingChanges: [],
});

describe('ChangeImpactController (e2e)', () => {
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

  const seedKeyword = async (appId: string, seeded: SeededKeyword) => {
    const keyword = await prisma.keyword.create({
      data: {
        text: seeded.text,
        store: Store.APP_STORE,
        country: seeded.country,
      },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: seeded.active,
      },
    });
    for (const [offset, traffic] of seeded.traffic) {
      await prisma.keywordMetric.create({
        data: {
          keywordId: keyword.id,
          date: on(offset),
          traffic,
          difficulty: 5,
          formulaVersion: CURRENT_FORMULA_VERSIONS.APP_STORE,
        },
      });
    }
    for (const [offset, position] of seeded.ranks) {
      await prisma.keywordRanking.create({
        data: {
          appId,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId: keyword.id,
          date: on(offset),
          position,
          depth: 200,
        },
      });
    }
  };

  const seed = async (): Promise<string> => {
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
          before: 'Focus',
          after: 'Focus Timer',
          capturedAt: at(0, 6),
        },
        {
          appId: primary.id,
          field: 'subtitle',
          before: 'Work',
          after: 'Deep work sessions',
          capturedAt: at(0, 18),
        },
        {
          appId: competitor.id,
          field: 'title',
          before: 'Rival',
          after: 'Rival Timer',
          capturedAt: at(5, 12),
        },
        {
          appId: primary.id,
          field: 'version',
          before: '1.0.0',
          after: '1.1.0',
          capturedAt: new Date(addDays(TODAY, -100).getTime() + 12 * HOUR_MS),
        },
      ],
    });
    for (const seeded of KEYWORDS) {
      await seedKeyword(primary.id, seeded);
    }
    return primary.id;
  };

  it('returns a 404 envelope for an unknown app id', async () => {
    const response = await api.get('/apps/missing/changes/impact').expect(404);

    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/apps/missing/changes/impact');
    expect(body.message).toBe('App missing not found');
  });

  it.each([
    'days=0',
    'days=366',
    'days=1.5',
    'country=DE',
    'country=usa',
    'market=us',
  ])('rejects %s with 400', async (query) => {
    const id = await seed();

    await api.get(`/apps/${id}/changes/impact?${query}`).expect(400);
  });

  it('reports how the home market moved after the change', async () => {
    const id = await seed();

    const response = await api.get(`/apps/${id}/changes/impact`).expect(200);

    expect(response.body as ChangeImpactReport).toEqual({
      appId: id,
      country: 'us',
      days: 90,
      totalChanges: 1,
      items: [
        {
          changedOn: toDateKey(on(0)),
          fields: ['title', 'subtitle'],
          baselineDate: toDateKey(on(-1)),
          windows: [
            {
              days: 7,
              status: 'measured',
              targetDate: toDateKey(on(7)),
              measuredOn: toDateKey(on(7)),
              movement: {
                improved: 1,
                declined: 1,
                unchanged: 0,
                entered: 1,
                exited: 0,
                measured: 3,
              },
              medianPositionChange: -1,
              visibilityBefore: 27.6,
              visibilityAfter: 36.1,
              visibilityChange: 8.5,
              overlappingChanges: [],
            },
            {
              days: 14,
              status: 'measured',
              targetDate: toDateKey(on(14)),
              measuredOn: toDateKey(on(13)),
              movement: {
                improved: 1,
                declined: 0,
                unchanged: 1,
                entered: 0,
                exited: 0,
                measured: 3,
              },
              medianPositionChange: -3.5,
              visibilityBefore: 27.6,
              visibilityAfter: 39.6,
              visibilityChange: 12,
              overlappingChanges: [],
            },
            pendingWindow(28),
          ],
        },
      ],
    });
  });

  it('measures the market named by country', async () => {
    const id = await seed();

    const response = await api
      .get(`/apps/${id}/changes/impact?country=gb`)
      .expect(200);

    const report = response.body as ChangeImpactReport;
    const [week, fortnight] = report.items[0].windows;
    expect(report.country).toBe('gb');
    expect(week).toMatchObject({
      movement: { improved: 1, measured: 1 },
      medianPositionChange: -8,
      visibilityBefore: 22.8,
      visibilityAfter: 27,
      visibilityChange: 4.2,
    });
    expect(fortnight).toMatchObject({
      measuredOn: toDateKey(on(13)),
      movement: { declined: 1, measured: 1 },
      medianPositionChange: 5,
      visibilityAfter: 21.3,
      visibilityChange: -1.5,
    });
  });

  it('widens the window with days and leaves an unanchored change unmeasured', async () => {
    const id = await seed();

    const narrow = await api.get(`/apps/${id}/changes/impact`).expect(200);
    const wide = await api
      .get(`/apps/${id}/changes/impact?days=120`)
      .expect(200);

    expect((narrow.body as ChangeImpactReport).totalChanges).toBe(1);
    const report = wide.body as ChangeImpactReport;
    expect(report.totalChanges).toBe(2);
    expect(report.items[1]).toMatchObject({
      changedOn: toDateKey(addDays(TODAY, -100)),
      fields: ['version'],
      baselineDate: null,
    });
    expect(report.items[1].windows.map((window) => window.status)).toEqual([
      'unmeasured',
      'unmeasured',
      'unmeasured',
    ]);
  });
});
