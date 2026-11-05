import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  KeywordBreakdown,
  KeywordMarkSegment,
  MetadataAuditResult,
  TrackedKeywordItem,
} from '@asobeast/shared';
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

  const seedListing = (
    appId: string,
    texts: {
      title: string;
      subtitle?: string;
      summary?: string;
      description?: string;
    },
    where: { country?: string; localization?: string } = {},
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        description: '',
        raw: {},
        ...texts,
        ...where,
      },
    });

  const trackIn = async (
    appId: string,
    text: string,
    country = 'us',
    store: Store = Store.APP_STORE,
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
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
    beforeEach(() => {
      jest.useFakeTimers({
        now: Date.now(),
        doNotFake: [
          'hrtime',
          'nextTick',
          'performance',
          'queueMicrotask',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'requestIdleCallback',
          'cancelIdleCallback',
          'setImmediate',
          'clearImmediate',
          'setInterval',
          'clearInterval',
          'setTimeout',
          'clearTimeout',
        ],
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

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

    it('ignores a competitor below the top 10 and keeps volatility', async () => {
      const primary = await seedApp();
      await seedCompetitor(primary.id, '222');
      await seedCompetitor(primary.id, '333');
      const topTen = Array.from({ length: 10 }, (_, index) =>
        index === 1 ? '222' : `top-${index}`,
      );
      const earlier = ['top-0', '222', 'gone', ...topTen.slice(3)];
      const deepId = await track(primary.id, 'deep');
      const plainId = await track(primary.id, 'plain');
      for (const keywordId of [deepId, plainId]) {
        await snapshot(keywordId, daysAgo(1), earlier);
        await snapshot(keywordId, utcToday(), topTen);
      }
      await prisma.serpEntry.create({
        data: {
          keywordId: deepId,
          date: utcToday(),
          position: 11,
          storeAppId: '333',
          title: '333',
        },
      });

      const byText = new Map(
        (await list(primary.id)).map((item) => [item.text, item]),
      );

      expect(byText.get('deep')?.competitorsInTop10).toBe(1);
      expect(byText.get('deep')?.serpVolatility7d).toBe(
        byText.get('plain')?.serpVolatility7d,
      );
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

    it('counts a snapshot from yesterday and not one from two days ago', async () => {
      const primary = await seedApp();
      await seedCompetitor(primary.id, '222');
      const yesterday = await track(primary.id, 'yesterday');
      const twoDaysAgo = await track(primary.id, 'two days ago');
      await snapshot(yesterday, daysAgo(1), ['222']);
      await snapshot(twoDaysAgo, daysAgo(2), ['222']);

      const byText = new Map(
        (await list(primary.id)).map((item) => [item.text, item]),
      );

      expect(byText.get('yesterday')?.competitorsInTop10).toBe(1);
      expect(byText.get('two days ago')?.competitorsInTop10).toBeNull();
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
  describe('dropStreak', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const daysAgo = (days: number): Date =>
      new Date(utcToday().getTime() - days * DAY_MS);

    const rank = (
      appId: string,
      keywordId: string,
      oldestFirst: (number | null)[],
    ) =>
      prisma.keywordRanking.createMany({
        data: oldestFirst.map((position, index) => ({
          appId,
          workspaceId: DEFAULT_WORKSPACE_ID,
          keywordId,
          date: daysAgo(oldestFirst.length - 1 - index),
          position,
        })),
      });

    it('counts the checks in a row at which the position got worse', async () => {
      const primary = await seedApp();
      const keywordId = await track(primary.id, 'pomodoro');
      await rank(primary.id, keywordId, [3, 5, 7, 9]);

      const [item] = await list(primary.id);

      expect(item.dropStreak).toBe(3);
    });

    it('ends the run at an unchanged position', async () => {
      const primary = await seedApp();
      const keywordId = await track(primary.id, 'pomodoro');
      await rank(primary.id, keywordId, [3, 5, 5, 7, 9]);

      const [item] = await list(primary.id);

      expect(item.dropStreak).toBe(2);
    });

    it('answers null for a paused keyword', async () => {
      const primary = await seedApp();
      const keywordId = await track(primary.id, 'pomodoro');
      await rank(primary.id, keywordId, [3, 5, 7, 9]);
      await api
        .patch(`/apps/${primary.id}/keywords/${keywordId}`)
        .send({ active: false })
        .expect(200);

      const [item] = await list(primary.id);

      expect(item.dropStreak).toBeNull();
    });

    it('leaves the field off the answers that do not ask for it', async () => {
      const primary = await seedApp();
      const keywordId = await track(primary.id, 'pomodoro');
      await rank(primary.id, keywordId, [3, 5, 7, 9]);

      const field = await api
        .put(`/apps/${primary.id}/keyword-field`)
        .send({ text: 'pomodoro' })
        .expect(200);
      const audit = await api
        .get(`/apps/${primary.id}/metadata/audit`)
        .expect(200);

      expect(JSON.stringify(field.body)).not.toContain('dropStreak');
      expect(JSON.stringify(audit.body)).not.toContain('dropStreak');
    });
  });
  describe('uncovered', () => {
    const verdicts = async (appId: string) =>
      new Map(
        (await list(appId)).map((item) => [
          `${item.country}:${item.text}`,
          item.uncovered,
        ]),
      );

    const auditVerdicts = async (appId: string, country?: string) => {
      const audit = (
        await api
          .get(`/apps/${appId}/metadata/audit`)
          .query(country ? { country } : {})
          .expect(200)
      ).body as MetadataAuditResult;
      return new Map(
        audit.coverage.map((row) => [
          `${row.country}:${row.text}`,
          row.uncovered,
        ]),
      );
    };

    const expectAgreement = async (appId: string, markets: string[]) => {
      const listed = await verdicts(appId);
      const audited = new Map(
        (
          await Promise.all(
            markets.map((market) => auditVerdicts(appId, market)),
          )
        ).flatMap((rows) => [...rows]),
      );
      for (const [key, verdict] of audited) {
        expect([key, listed.get(key)]).toEqual([key, verdict]);
      }
      expect(audited.size).toBe(
        [...listed.values()].filter((verdict) => verdict !== undefined).length,
      );
    };

    const seedFocusTimer = async () => {
      const primary = await seedApp();
      await seedListing(primary.id, {
        title: 'Focus Timer',
        subtitle: 'Pomodoro and study',
      });
      await seedListing(
        primary.id,
        { title: 'Licznik skupienia', subtitle: 'Nauka' },
        { country: 'pl' },
      );
      await trackIn(primary.id, 'focus timer');
      await trackIn(primary.id, 'pomodoro');
      await trackIn(primary.id, 'habit planner');
      await trackIn(primary.id, 'licznik', 'pl');
      await trackIn(primary.id, 'pomodoro', 'pl');
      return primary;
    };

    it('answers whether a field of the listing of its market holds each keyword', async () => {
      const primary = await seedFocusTimer();
      const field = await api
        .put(`/apps/${primary.id}/keyword-field`)
        .send({ text: 'deep work' })
        .expect(200);

      const byKey = await verdicts(primary.id);

      expect(byKey.get('us:focus timer')).toBe(false);
      expect(byKey.get('us:pomodoro')).toBe(false);
      expect(byKey.get('us:habit planner')).toBe(true);
      expect(byKey.get('pl:licznik')).toBe(false);
      expect(byKey.get('pl:pomodoro')).toBe(true);
      expect(byKey.get('us:deep work')).toBe(false);
      expect(JSON.stringify(field.body)).not.toContain('uncovered');
    });

    it('agrees with the metadata coverage table in every market', async () => {
      const primary = await seedFocusTimer();

      await expectAgreement(primary.id, ['us', 'pl']);
    });

    it('agrees with the coverage table through a captured localization', async () => {
      const primary = await seedFocusTimer();
      await prisma.appLocalization.create({
        data: {
          appId: primary.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'es-MX',
          origin: 'manual',
        },
      });
      await seedListing(
        primary.id,
        { title: 'Temporizador de enfoque' },
        { localization: 'es-MX' },
      );
      await trackIn(primary.id, 'temporizador');

      expect((await verdicts(primary.id)).get('us:temporizador')).toBe(false);
      await expectAgreement(primary.id, ['us', 'pl']);
    });

    it('judges a Google Play keyword in the title and both descriptions', async () => {
      const primary = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.GOOGLE_PLAY,
          storeAppId: 'com.focus.timer',
          country: 'us',
          name: 'Focus Timer',
        },
      });
      await seedListing(primary.id, {
        title: 'Focus Timer',
        summary: 'Pomodoro sessions',
        description: 'Plan your deep work.',
      });
      for (const text of ['focus timer', 'pomodoro', 'deep work', 'habits']) {
        await trackIn(primary.id, text, 'us', Store.GOOGLE_PLAY);
      }

      const byKey = await verdicts(primary.id);

      expect(byKey.get('us:focus timer')).toBe(false);
      expect(byKey.get('us:pomodoro')).toBe(false);
      expect(byKey.get('us:deep work')).toBe(false);
      expect(byKey.get('us:habits')).toBe(true);
      await expectAgreement(primary.id, ['us']);
    });

    it('leaves the verdict off a paused keyword', async () => {
      const primary = await seedApp();
      await seedListing(primary.id, { title: 'Focus Timer' });
      const keywordId = await trackIn(primary.id, 'habit planner');
      await api
        .patch(`/apps/${primary.id}/keywords/${keywordId}`)
        .send({ active: false })
        .expect(200);

      const [item] = await list(primary.id);

      expect(item).not.toHaveProperty('uncovered');
    });
  });

  describe('matchedIn', () => {
    const marksOf = async (appId: string) =>
      new Map(
        (await list(appId)).map((item) => [
          `${item.country}:${item.text}`,
          item.matchedIn,
        ]),
      );

    const placesOf = (segments: KeywordMarkSegment[] | undefined) =>
      (segments ?? []).flatMap((segment) =>
        segment.surface
          ? [`${segment.text}:${segment.surface}:${segment.match}`]
          : [],
      );

    const seedHome = async () => {
      const primary = await seedApp();
      await seedListing(primary.id, {
        title: 'Focus Timer Pro',
        subtitle: 'Study sessions and café finder',
      });
      await api
        .put(`/apps/${primary.id}/keyword-field`)
        .send({ text: 'pomodoro,habit' })
        .expect(200);
      return primary;
    };

    it('marks the title, the subtitle and the saved keyword field', async () => {
      const primary = await seedHome();
      await trackIn(primary.id, 'focus timer');
      await trackIn(primary.id, 'focus study');

      const marks = await marksOf(primary.id);

      expect(marks.get('us:focus timer')).toEqual([
        { text: 'focus timer', surface: 'title', match: 'exact' },
      ]);
      expect(marks.get('us:focus study')).toEqual([
        { text: 'focus', surface: 'title', match: 'exact' },
        { text: ' ', surface: null },
        { text: 'study', surface: 'subtitle', match: 'exact' },
      ]);
      expect(marks.get('us:pomodoro')).toEqual([
        { text: 'pomodoro', surface: 'keywordField', match: 'exact' },
      ]);
    });

    it('leaves the field off a keyword with no word in the listing', async () => {
      const primary = await seedHome();
      await trackIn(primary.id, 'unrelated words');

      const item = (await list(primary.id)).find(
        (row) => row.text === 'unrelated words',
      );

      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('matchedIn');
    });

    it('marks a word of another localization the market reads', async () => {
      const primary = await seedHome();
      await prisma.appLocalization.create({
        data: {
          appId: primary.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          localization: 'es-MX',
          origin: 'manual',
        },
      });
      await seedListing(
        primary.id,
        { title: 'Temporizador de enfoque' },
        { localization: 'es-MX' },
      );
      await api
        .put(`/apps/${primary.id}/keyword-field`)
        .query({ localization: 'es-MX' })
        .send({ text: 'concentracion' })
        .expect(200);
      await trackIn(primary.id, 'enfoque temporizador');

      const marks = await marksOf(primary.id);

      expect(placesOf(marks.get('us:enfoque temporizador'))).toEqual([
        'enfoque temporizador:title:exact',
      ]);
      expect(placesOf(marks.get('us:concentracion'))).toEqual([
        'concentracion:keywordField:exact',
      ]);
    });

    it('marks a keyword field only in a market that reads a saved one', async () => {
      const primary = await seedHome();
      await seedListing(
        primary.id,
        { title: 'Gewohnheiten', subtitle: 'Fokus' },
        { country: 'de' },
      );
      await trackIn(primary.id, 'habit', 'de');

      expect((await marksOf(primary.id)).get('de:habit')).toBeUndefined();

      await api
        .put(`/apps/${primary.id}/keyword-field`)
        .query({ country: 'de', localization: 'de' })
        .send({ text: 'habit' })
        .expect(200);

      expect(placesOf((await marksOf(primary.id)).get('de:habit'))).toEqual([
        'habit:keywordField:exact',
      ]);
    });

    it('judges a market on its own listing and falls back to the home one', async () => {
      const primary = await seedHome();
      await seedListing(
        primary.id,
        { title: 'Gewohnheiten' },
        { country: 'de' },
      );
      await trackIn(primary.id, 'gewohnheiten', 'de');
      await trackIn(primary.id, 'focus', 'de');
      await trackIn(primary.id, 'focus', 'fr');

      const marks = await marksOf(primary.id);

      expect(placesOf(marks.get('de:gewohnheiten'))).toEqual([
        'gewohnheiten:title:exact',
      ]);
      expect(marks.get('de:focus')).toBeUndefined();
      expect(placesOf(marks.get('fr:focus'))).toEqual(['focus:title:exact']);
    });

    it('marks a paused keyword too', async () => {
      const primary = await seedHome();
      const keywordId = await trackIn(primary.id, 'focus timer');
      await api
        .patch(`/apps/${primary.id}/keywords/${keywordId}`)
        .send({ active: false })
        .expect(200);

      expect(
        placesOf((await marksOf(primary.id)).get('us:focus timer')),
      ).toEqual(['focus timer:title:exact']);
    });

    it('marks a word found only with accents ignored as folded', async () => {
      const primary = await seedHome();
      await trackIn(primary.id, 'cafe finder');

      expect((await marksOf(primary.id)).get('us:cafe finder')).toEqual([
        { text: 'cafe', surface: 'subtitle', match: 'folded' },
        { text: ' ', surface: null },
        { text: 'finder', surface: 'subtitle', match: 'exact' },
      ]);
    });

    it('splits every keyword into runs that join back into its text', async () => {
      const primary = await seedHome();
      for (const text of ['focus timer', 'study app', 'cafe finder']) {
        await trackIn(primary.id, text);
      }

      for (const item of await list(primary.id)) {
        if (item.matchedIn === undefined) continue;
        expect(item.matchedIn.map((segment) => segment.text).join('')).toBe(
          item.text,
        );
      }
    });

    it('marks a Google Play title and short description and never the description', async () => {
      const primary = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.GOOGLE_PLAY,
          storeAppId: 'com.focus.timer',
          country: 'us',
          name: 'Focus Timer',
        },
      });
      await seedListing(primary.id, {
        title: 'Focus Timer',
        summary: 'Pomodoro sessions',
        description: 'Plan your deep work.',
      });
      for (const text of ['focus pomodoro', 'deep work']) {
        await trackIn(primary.id, text, 'us', Store.GOOGLE_PLAY);
      }

      const marks = await marksOf(primary.id);

      expect(placesOf(marks.get('us:focus pomodoro'))).toEqual([
        'focus:title:exact',
        'pomodoro:shortDescription:exact',
      ]);
      expect(marks.get('us:deep work')).toBeUndefined();
    });

    it('agrees with the coverage table and the keyword breakdown', async () => {
      const primary = await seedHome();
      const studyId = await trackIn(primary.id, 'focus study');
      for (const text of ['focus timer', 'unrelated words', 'cafe finder']) {
        await trackIn(primary.id, text);
      }
      const audit = (
        await api.get(`/apps/${primary.id}/metadata/audit`).expect(200)
      ).body as MetadataAuditResult;
      const marks = await marksOf(primary.id);

      for (const row of audit.coverage.filter((each) => !each.uncovered)) {
        const segments = marks.get(`${row.country}:${row.text}`) ?? [];
        expect(
          segments.every(
            (segment) => segment.surface !== null || segment.text.trim() === '',
          ),
        ).toBe(true);
      }
      const breakdown = (
        await api
          .get(`/apps/${primary.id}/keywords/${studyId}/breakdown`)
          .expect(200)
      ).body as KeywordBreakdown;
      const fields = breakdown.apps[0].listings[0].fields;
      const wordIn = (field: string, word: string) =>
        fields
          .find((each) => each.field === field)
          ?.words.find((each) => each.word === word)?.match;

      expect(wordIn('title', 'focus')).toBe('exact');
      expect(wordIn('subtitle', 'study')).toBe('exact');
      expect(placesOf(marks.get('us:focus study'))).toEqual([
        'focus:title:exact',
        'study:subtitle:exact',
      ]);
    });

    it('leaves the marks off the answers that do not ask for them', async () => {
      const primary = await seedHome();

      const added = await api
        .post(`/apps/${primary.id}/keywords`)
        .send({ keywords: ['focus timer'] })
        .expect(201);
      const audit = await api
        .get(`/apps/${primary.id}/metadata/audit`)
        .expect(200);

      expect(JSON.stringify(added.body)).not.toContain('matchedIn');
      expect(JSON.stringify(audit.body)).not.toContain('matchedIn');
    });
  });

  describe('keywordClass', () => {
    const seedForest = async () => {
      const primary = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '111',
          country: 'us',
          name: 'Forest: Stay Focused',
        },
      });
      await prisma.appSnapshot.create({
        data: {
          appId: primary.id,
          title: 'Forest: Stay Focused',
          description: 'Plant a tree and stay off your phone.',
          raw: { developer: 'Seekrtech Inc.' },
        },
      });
      const rival = await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '222',
          country: 'us',
          name: 'Todoist - To-Do List',
          isCompetitor: true,
          primaryAppId: primary.id,
        },
      });
      return { primary, rival };
    };

    const scoreSignals = (flags: string[], serpRelevance: number) => ({
      signals: {
        suggestReach: 'hit',
        suggestPrefixLength: 2,
        suggestPosition: 1,
        serpRelevance,
        medianRatingCount: null,
        flags,
        officialPopularity: null,
        estimatedTraffic: null,
      },
    });

    const score = (keywordId: string, flags: string[], serpRelevance: number) =>
      prisma.keywordMetric.create({
        data: {
          keywordId,
          date: utcToday(),
          traffic: 5,
          difficulty: 5,
          stats: scoreSignals(flags, serpRelevance),
        },
      });

    const classesOf = async (appId: string) =>
      Object.fromEntries(
        (await list(appId)).map((item) => [
          item.text,
          [item.keywordClass, item.keywordClassSource],
        ]),
      );

    it('reads the own name, the developer and a competitor name from the stored listings', async () => {
      const { primary } = await seedForest();
      for (const text of ['forest', 'seekrtech', 'todoist', 'habit tracker']) {
        await track(primary.id, text);
      }

      await expect(classesOf(primary.id)).resolves.toEqual({
        forest: ['ownBrand', 'detected'],
        seekrtech: ['ownBrand', 'detected'],
        todoist: ['competitorBrand', 'detected'],
        'habit tracker': ['generic', 'detected'],
      });
    });

    it('reads the title of the keyword market as an own name there only', async () => {
      const { primary } = await seedForest();
      await seedListing(
        primary.id,
        { title: 'Wald: Konzentration', description: 'Pflanze einen Baum.' },
        { country: 'de' },
      );
      await trackIn(primary.id, 'wald', 'de');
      await trackIn(primary.id, 'wald', 'us');

      const classes = (await list(primary.id)).map((item) => [
        item.country,
        item.keywordClass,
      ]);

      expect(classes).toEqual(
        expect.arrayContaining([
          ['de', 'ownBrand'],
          ['us', 'generic'],
        ]),
      );
    });

    it('reads a competitor brand as generic once the competitor is removed', async () => {
      const { primary, rival } = await seedForest();
      await track(primary.id, 'todoist');
      await api
        .delete(`/apps/${primary.id}/competitors/${rival.id}`)
        .expect(204);

      const [item] = await list(primary.id);

      expect(item.keywordClass).toBe('generic');
    });

    it('reads a flagged brand search with no name to match as a competitor brand', async () => {
      const { primary } = await seedForest();
      await score(await track(primary.id, 'geoguessr'), ['brand'], 0.05);

      const [item] = await list(primary.id);

      expect(item.keywordClass).toBe('competitorBrand');
    });

    it('reads a name match as generic when most of the page targets the phrase', async () => {
      const { primary } = await seedForest();
      await score(await track(primary.id, 'forest'), [], 0.9);

      const [item] = await list(primary.id);

      expect(item.keywordClass).toBe('generic');
    });

    it('leaves the field off the answers that do not ask for it', async () => {
      const { primary } = await seedForest();
      await track(primary.id, 'forest');

      const field = await api
        .put(`/apps/${primary.id}/keyword-field`)
        .send({ text: 'todoist' })
        .expect(200);
      const audit = await api
        .get(`/apps/${primary.id}/metadata/audit`)
        .expect(200);

      expect(JSON.stringify(field.body)).not.toContain('keywordClass');
      expect(JSON.stringify(audit.body)).not.toContain('keywordClass');
    });
  });
});
