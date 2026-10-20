import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { KeywordComparison } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { utcToday } from '../src/analytics/analytics.support';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';

describe('KeywordsController compare (e2e)', () => {
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

  const MARKETS = [
    { country: 'us', you: 4, them: 9 },
    { country: 'de', you: null, them: 2 },
  ];

  const seed = async (): Promise<string> => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Focus Timer',
      },
    });
    const competitor = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222',
        country: 'us',
        name: 'Rival Focus',
        isCompetitor: true,
        primaryAppId: primary.id,
      },
    });
    for (const market of MARKETS) {
      const keyword = await prisma.keyword.create({
        data: {
          text: 'pomodoro',
          store: Store.APP_STORE,
          country: market.country,
        },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: primary.id,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: true,
        },
      });
      for (const [appId, position] of [
        [primary.id, market.you],
        [competitor.id, market.them],
      ] as const) {
        await prisma.keywordRanking.create({
          data: {
            appId,
            workspaceId: DEFAULT_WORKSPACE_ID,
            keywordId: keyword.id,
            date: utcToday(),
            position,
            depth: 200,
          },
        });
      }
    }
    return primary.id;
  };
  const seedUnchecked = async () => {
    const primary = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Focus Timer',
      },
    });
    const rival = (storeAppId: string, name: string) =>
      prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId,
          country: 'us',
          name,
          isCompetitor: true,
          primaryAppId: primary.id,
        },
      });
    const checked = await rival('222', 'Checked Rival');
    const fresh = await rival('333', 'Fresh Rival');
    const keyword = await prisma.keyword.create({
      data: { text: 'pomodoro', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: primary.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    await prisma.keywordRanking.create({
      data: {
        appId: checked.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: keyword.id,
        date: utcToday(),
        position: null,
        depth: 200,
      },
    });
    return { primary, checked, fresh };
  };

  it('answers the market of every row', async () => {
    const appId = await seed();

    const res = await api.get(`/apps/${appId}/keywords/compare`).expect(200);
    const body = res.body as KeywordComparison;

    const rows = body.rows.filter((row) => row.text === 'pomodoro');
    expect(rows.map((row) => row.country).sort()).toEqual(['de', 'us']);
    for (const market of MARKETS) {
      expect(rows.find((row) => row.country === market.country)?.you).toBe(
        market.you,
      );
    }
  });

  it('keeps the market on gap rows', async () => {
    const appId = await seed();

    const res = await api
      .get(`/apps/${appId}/keywords/compare?onlyGaps=true`)
      .expect(200);
    const body = res.body as KeywordComparison;

    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      text: 'pomodoro',
      country: 'de',
      gap: true,
    });
  });

  it('lists the apps never checked and keeps the ones checked and not found out', async () => {
    const { primary, checked, fresh } = await seedUnchecked();

    const res = await api
      .get(`/apps/${primary.id}/keywords/compare`)
      .expect(200);
    const [row] = (res.body as KeywordComparison).rows;

    expect(row.you).toBeNull();
    expect(row.positions).toEqual({ [checked.id]: null, [fresh.id]: null });
    expect(row.unchecked).toEqual([primary.id, fresh.id]);
  });
});
