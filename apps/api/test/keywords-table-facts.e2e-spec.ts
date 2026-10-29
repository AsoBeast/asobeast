import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { TrackedKeywordItem } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { utcToday } from '../src/analytics/analytics.support';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('KeywordsController table facts (e2e)', () => {
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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = (storeAppId = '111') =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: 'Focus Timer',
      },
    });

  const track = async (appId: string, text: string, createdAt = new Date()) => {
    const keyword = await prisma.keyword.create({
      data: { text, store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
        createdAt,
      },
    });
    return keyword.id;
  };

  const list = async (
    appId: string,
    query: Record<string, string> = {},
  ): Promise<TrackedKeywordItem[]> =>
    (await api.get(`/apps/${appId}/keywords`).query(query).expect(200))
      .body as TrackedKeywordItem[];

  describe('trackedAt', () => {
    it('carries the instant each keyword started being tracked', async () => {
      const primary = await seedApp();
      await track(
        primary.id,
        'focus timer',
        new Date('2026-10-01T08:00:00.000Z'),
      );

      const [item] = await list(primary.id);

      expect(item.trackedAt).toBe('2026-10-01T08:00:00.000Z');
    });

    it('keeps it when a keyword is paused and resumed', async () => {
      const primary = await seedApp();
      const keywordId = await track(
        primary.id,
        'focus timer',
        new Date('2026-10-01T08:00:00.000Z'),
      );

      await api
        .patch(`/apps/${primary.id}/keywords/${keywordId}`)
        .send({ active: false })
        .expect(200);
      await api
        .patch(`/apps/${primary.id}/keywords/${keywordId}`)
        .send({ active: true })
        .expect(200);

      const [item] = await list(primary.id);
      expect(item.trackedAt).toBe('2026-10-01T08:00:00.000Z');
    });

    it('sorts the newest first with sort=added', async () => {
      const primary = await seedApp();
      await track(primary.id, 'oldest', new Date('2026-09-01T00:00:00.000Z'));
      await track(primary.id, 'newest', new Date('2026-10-20T00:00:00.000Z'));
      await track(primary.id, 'middle', new Date('2026-10-01T00:00:00.000Z'));

      const sorted = await list(primary.id, { sort: 'added' });

      expect(sorted.map((item) => item.text)).toEqual([
        'newest',
        'middle',
        'oldest',
      ]);
    });

    it('refuses a sort the list does not know', async () => {
      const primary = await seedApp();

      await api
        .get(`/apps/${primary.id}/keywords`)
        .query({ sort: 'added-ish' })
        .expect(400);
    });
  });

  describe('competitorsInTop10', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const daysAgo = (days: number): Date =>
      new Date(utcToday().getTime() - days * DAY_MS);

    const seedCompetitor = (primaryId: string, storeAppId: string) =>
      prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId,
          country: 'us',
          name: `Rival ${storeAppId}`,
          isCompetitor: true,
          primaryAppId: primaryId,
        },
      });

    const snapshot = (keywordId: string, date: Date, storeAppIds: string[]) =>
      prisma.serpEntry.createMany({
        data: storeAppIds.map((storeAppId, index) => ({
          keywordId,
          date,
          position: index + 1,
          storeAppId,
          title: storeAppId,
        })),
      });

    it('counts the competitors of the app in the newest top 10', async () => {
      const primary = await seedApp();
      await seedCompetitor(primary.id, '222');
      await seedCompetitor(primary.id, '333');
      const keywordId = await track(primary.id, 'pomodoro');
      await snapshot(keywordId, daysAgo(1), ['222', '333', '111']);
      await snapshot(keywordId, utcToday(), ['999', '222', '111', '555']);

      const [item] = await list(primary.id);

      expect(item.competitorsInTop10).toBe(1);
    });

    it('does not count the competitors of another app', async () => {
      const primary = await seedApp();
      const other = await seedApp('777');
      await seedCompetitor(other.id, '555');
      const keywordId = await track(primary.id, 'pomodoro');
      await seedCompetitor(primary.id, '222');
      await snapshot(keywordId, utcToday(), ['555', '222']);

      const items = await list(primary.id);

      expect(
        items.find((item) => item.text === 'pomodoro')?.competitorsInTop10,
      ).toBe(1);
    });

    it('answers null without a snapshot, with an old one or without competitors', async () => {
      const primary = await seedApp();
      await seedCompetitor(primary.id, '222');
      const fresh = await track(primary.id, 'fresh');
      const stale = await track(primary.id, 'stale');
      await track(primary.id, 'unchecked');
      await snapshot(fresh, utcToday(), ['222']);
      await snapshot(stale, daysAgo(5), ['222']);

      const byText = new Map(
        (await list(primary.id)).map((item) => [item.text, item]),
      );

      expect(byText.get('fresh')?.competitorsInTop10).toBe(1);
      expect(byText.get('stale')?.competitorsInTop10).toBeNull();
      expect(byText.get('unchecked')?.competitorsInTop10).toBeNull();
    });

    it('answers null for every keyword of an app with no competitor', async () => {
      const primary = await seedApp();
      const keywordId = await track(primary.id, 'pomodoro');
      await snapshot(keywordId, utcToday(), ['222']);

      const [item] = await list(primary.id);

      expect(item.competitorsInTop10).toBeNull();
    });

    it('leaves the field off the answers that do not ask for it', async () => {
      const primary = await seedApp();
      await seedCompetitor(primary.id, '222');
      const keywordId = await track(primary.id, 'pomodoro');
      await snapshot(keywordId, utcToday(), ['222']);

      const patched = await api
        .patch(`/apps/${primary.id}/keywords/${keywordId}`)
        .send({ relevance: 80 })
        .expect(200);

      expect(patched.body).not.toHaveProperty('competitorsInTop10');
    });

    it('sorts the most competitors first with null last', async () => {
      const primary = await seedApp();
      await seedCompetitor(primary.id, '222');
      await seedCompetitor(primary.id, '333');
      const one = await track(primary.id, 'one');
      const two = await track(primary.id, 'two');
      await track(primary.id, 'none');
      await snapshot(one, utcToday(), ['222']);
      await snapshot(two, utcToday(), ['222', '333']);

      const sorted = await list(primary.id, { sort: 'competitors' });

      expect(sorted.map((item) => item.text)).toEqual(['two', 'one', 'none']);
    });
  });
});
