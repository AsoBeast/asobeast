import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppLocalizationsResult,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordFieldSavePreview,
  LocalizedKeywordFieldResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import request from 'supertest';
import {
  firstRunCheckJobId,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

const NUL = '\u0000';

const COMPETITOR_REFUSAL =
  'A competitor app has no localizations or keyword fields; use its primary app';

const OVERSIZED = Array.from(
  { length: 12 },
  (_, index) => `phrase ${String(index).padStart(2, '0')}`,
).join(',');

const STEM = [0x20bb7, 0x91ce, 0x5bb6];

const astralPhrase = (index: number): string =>
  String.fromCodePoint(...STEM, 0x20000 + index, 0x2a6a5, 0x2a6a5);

const astralField = (lastPhraseCharacters: number): string =>
  [
    ...Array.from({ length: 14 }, (_, index) => astralPhrase(index)),
    String.fromCodePoint(...STEM.slice(0, lastPhraseCharacters)),
  ].join(',');

describe('Localized keyword fields (e2e)', () => {
  let harness: BillingHarness;

  const seedApp = async (
    storeAppId = 'fields',
    store: Store = Store.APP_STORE,
    country = 'us',
  ): Promise<string> =>
    (
      await harness.prisma.app.create({
        data: { workspaceId: WORKSPACE, store, storeAppId, country },
        select: { id: true },
      })
    ).id;

  const seedCompetitor = async (primaryAppId: string): Promise<string> =>
    (
      await harness.prisma.app.create({
        data: {
          workspaceId: WORKSPACE,
          store: Store.APP_STORE,
          storeAppId: 'rival',
          country: 'us',
          isCompetitor: true,
          primaryAppId,
        },
        select: { id: true },
      })
    ).id;

  const trackActive = async (
    appId: string,
    country: string,
    texts: string[],
  ) => {
    await harness.prisma.keyword.createMany({
      data: texts.map((text) => ({ text, store: Store.APP_STORE, country })),
      skipDuplicates: true,
    });
    const keywords = await harness.prisma.keyword.findMany({
      where: { country, text: { in: texts } },
      select: { id: true },
    });
    await harness.prisma.trackedKeyword.createMany({
      data: keywords.map(({ id }) => ({
        appId,
        keywordId: id,
        source: 'MANUAL',
      })),
    });
  };

  const withMarkets = async (appId: string, ...countries: string[]) => {
    for (const country of countries) {
      await trackActive(appId, country, [`seed ${country}`]);
    }
  };

  const save = (appId: string, localization: string, body: object) =>
    harness.owner
      .put(`/apps/${appId}/keyword-fields/${localization}`)
      .send(body);

  const fieldTexts = async (
    appId: string,
    country: string,
  ): Promise<string[]> =>
    (
      await harness.prisma.trackedKeyword.findMany({
        where: {
          appId,
          active: true,
          source: 'KEYWORD_FIELD',
          keyword: { is: { country } },
        },
        select: { keyword: { select: { text: true } } },
      })
    )
      .map((row) => row.keyword.text)
      .sort();

  const written = async () => ({
    fields: await harness.prisma.keywordField.count(),
    localizations: await harness.prisma.appLocalization.count(),
    tracked: await harness.prisma.trackedKeyword.count({
      where: { source: 'KEYWORD_FIELD' },
    }),
  });

  const messageOf = (response: { body: unknown }) =>
    (response.body as ApiErrorEnvelope).message;

  const queuedJobs = () =>
    harness.app
      .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
      .getJobs(['waiting', 'paused', 'delayed']);

  beforeAll(async () => {
    harness = await startBillingHarness(false);
  }, 60_000);

  beforeEach(async () => {
    await resetBillingState(harness, { plan: 'ultimate', trialEndsAt: null });
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(() => stopBillingHarness(harness));

  describe('save', () => {
    it('E-SAV-01 tracks every phrase in every market it is saved for', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');

      const response = await save(appId, 'es-MX', {
        text: 'uno,dos, uno',
        trackIn: ['us', 'mx'],
      }).expect(200);

      expect(response.body as LocalizedKeywordFieldResult).toMatchObject({
        duplicatesRemoved: 1,
        trackedIn: ['us', 'mx'],
        localization: {
          localization: 'es-MX',
          phrases: ['uno', 'dos'],
          charactersUsed: 7,
          charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
          readBy: [
            { country: 'us', role: 'additional', home: true },
            { country: 'mx', role: 'default', home: false },
          ],
        },
      });
      expect(await fieldTexts(appId, 'us')).toEqual(['dos', 'uno']);
      expect(await fieldTexts(appId, 'mx')).toEqual(['dos', 'uno']);
    });

    it('E-SAV-02 stores the field and tracks nothing for an empty trackIn', async () => {
      const appId = await seedApp();

      const response = await save(appId, 'es-MX', {
        text: 'uno,dos',
        trackIn: [],
      }).expect(200);

      expect((response.body as LocalizedKeywordFieldResult).trackedIn).toEqual(
        [],
      );
      await expect(
        harness.prisma.keywordField.findUniqueOrThrow({
          where: { appId_localization: { appId, localization: 'es-MX' } },
        }),
      ).resolves.toMatchObject({ phrases: ['uno', 'dos'] });
      expect((await written()).tracked).toBe(0);
    });

    it('E-SAV-03 tracks only the chosen market of two that read the localization', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');

      const response = await save(appId, 'es-MX', {
        text: 'uno,dos',
        trackIn: ['mx'],
      }).expect(200);

      expect(await fieldTexts(appId, 'mx')).toEqual(['dos', 'uno']);
      expect(await fieldTexts(appId, 'us')).toEqual([]);
      expect(
        (response.body as LocalizedKeywordFieldResult).localization.readBy.map(
          (reader) => reader.country,
        ),
      ).toEqual(['us', 'mx']);
    });

    it('E-SAV-04 untracks a dropped phrase in every market that reads the localization', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');
      await save(appId, 'es-MX', {
        text: 'uno,dos',
        trackIn: ['us', 'mx'],
      }).expect(200);

      await save(appId, 'es-MX', { text: 'uno', trackIn: [] }).expect(200);

      expect(await fieldTexts(appId, 'us')).toEqual(['uno']);
      expect(await fieldTexts(appId, 'mx')).toEqual(['uno']);
    });

    it('E-SAV-05 keeps a dropped phrase another field of the market still holds', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');
      await save(appId, 'en-US', { text: 'dos', trackIn: ['us'] }).expect(200);
      await save(appId, 'es-MX', {
        text: 'uno,dos',
        trackIn: ['us', 'mx'],
      }).expect(200);

      await save(appId, 'es-MX', { text: 'uno', trackIn: [] }).expect(200);

      expect(await fieldTexts(appId, 'us')).toEqual(['dos', 'uno']);
      expect(await fieldTexts(appId, 'mx')).toEqual(['uno']);
    });

    it('E-SAV-06 refuses a trackIn country that is not one of the app markets', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');
      const before = await written();

      const response = await save(appId, 'es-MX', {
        text: 'uno',
        trackIn: ['de'],
      }).expect(400);

      expect(messageOf(response)).toBe("DE is not one of this app's markets");
      expect(await written()).toEqual(before);
    });

    it('E-SAV-07 refuses a trackIn market whose storefront does not read the localization', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');

      const response = await save(appId, 'en-US', {
        text: 'uno',
        trackIn: ['mx'],
      }).expect(400);

      expect(messageOf(response)).toBe(
        'The MX storefront does not read English (U.S.)',
      );
    });

    it('E-SAV-08 refuses a field over 100 characters and stores nothing', async () => {
      const appId = await seedApp();
      const before = await written();

      const response = await save(appId, 'en-US', {
        text: OVERSIZED,
        trackIn: ['us'],
      }).expect(400);

      expect(messageOf(response)).toBe('Keyword field exceeds 100 characters');
      expect(await written()).toEqual(before);
    });
    it('E-SAV-ASTRAL-01 accepts a field of exactly 100 characters that holds characters outside the bmp', async () => {
      const appId = await seedApp();

      const response = await save(appId, 'en-US', {
        text: astralField(2),
        trackIn: ['us'],
      }).expect(200);

      expect(
        (response.body as LocalizedKeywordFieldResult).localization,
      ).toMatchObject({
        charactersUsed: KEYWORD_FIELD_CHAR_LIMIT,
        charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      });
      expect(await fieldTexts(appId, 'us')).toHaveLength(15);
    });

    it('E-SAV-ASTRAL-02 refuses 101 characters that include characters outside the bmp and stores nothing', async () => {
      const appId = await seedApp();
      const before = await written();

      const response = await save(appId, 'en-US', {
        text: astralField(3),
        trackIn: ['us'],
      }).expect(400);

      expect(messageOf(response)).toBe('Keyword field exceeds 100 characters');
      expect(await written()).toEqual(before);
    });

    it('E-SAV-ASTRAL-03 tracks a phrase of 51 characters outside the bmp', async () => {
      const appId = await seedApp();
      const phrase = String.fromCodePoint(STEM[0]).repeat(51);

      await save(appId, 'en-US', { text: phrase, trackIn: ['us'] }).expect(200);

      expect(await fieldTexts(appId, 'us')).toEqual([phrase]);
    });

    it('E-SAV-09 refuses a localization outside the 50', async () => {
      const appId = await seedApp();

      const response = await save(appId, 'xx', {
        text: 'uno',
        trackIn: [],
      }).expect(400);

      expect(messageOf(response)).toBe('Unknown App Store localization: xx');
    });

    it.each([
      { text: 'a' },
      { trackIn: [] },
      { text: 5, trackIn: [] },
      { text: 'a', trackIn: ['us', 'us'] },
      { text: 'a', trackIn: ['USA'] },
      {
        text: 'a',
        trackIn: Array.from({ length: 201 }, (_, index) =>
          String.fromCharCode(97 + Math.floor(index / 26), 97 + (index % 26)),
        ),
      },
    ])('E-SAV-10 refuses a malformed body (%#)', async (body) => {
      const appId = await seedApp();
      const before = await written();

      await save(appId, 'en-US', body).expect(400);

      expect(await written()).toEqual(before);
    });

    it('E-SAV-11 refuses with 403 and writes nothing when the markets do not fit', async () => {
      await resetBillingState(harness, { plan: 'indie', trialEndsAt: null });
      const limit = PLAN_LIMITS.indie.keywordMarkets as number;
      const appId = await seedApp();
      await withMarkets(appId, 'mx');
      await trackActive(
        appId,
        'us',
        Array.from({ length: limit - 3 }, (_, index) => `filler ${index}`),
      );

      const response = await save(appId, 'es-MX', {
        text: 'uno,dos,tres',
        trackIn: ['us', 'mx'],
      }).expect(403);

      expect((response.body as ApiErrorEnvelope).quota).toMatchObject({
        resource: 'keywordMarkets',
        limit,
        used: limit - 2,
        requested: 6,
      });
      expect(await written()).toEqual({
        fields: 0,
        localizations: 0,
        tracked: 0,
      });
    });

    it('E-SAV-12 refuses a read only token and writes nothing', async () => {
      const appId = await seedApp();
      const before = await written();

      await request(harness.app.getHttpServer())
        .put(`/apps/${appId}/keyword-fields/en-US`)
        .set('Authorization', `Bearer ${harness.memberToken}`)
        .send({ text: 'uno', trackIn: ['us'] })
        .expect(403);

      expect(await written()).toEqual(before);
    });

    it('E-SAV-13 answers 402 for a workspace without a plan in force', async () => {
      await resetBillingState(harness, {
        plan: 'free',
        trialEndsAt: new Date(Date.now() - 1_000),
      });
      const appId = await seedApp();

      await save(appId, 'en-US', { text: 'uno', trackIn: ['us'] }).expect(402);
    });

    it('E-SAV-14 refuses a Google Play app and a missing app', async () => {
      const appId = await seedApp('play', Store.GOOGLE_PLAY);

      const response = await save(appId, 'en-US', {
        text: 'uno',
        trackIn: [],
      }).expect(400);
      const old = await harness.owner
        .put(`/apps/${appId}/keyword-field`)
        .send({ text: 'uno' })
        .expect(400);

      expect(messageOf(response)).toBe(
        'The keyword field is only available for App Store apps',
      );
      expect(messageOf(response)).toBe(messageOf(old));
      await save('missing-app', 'en-US', { text: 'uno', trackIn: [] }).expect(
        404,
      );
    });

    it('E-SAV-15 refuses a NUL character in the text and in trackIn', async () => {
      const appId = await seedApp();
      const before = await written();

      const inText = await save(appId, 'en-US', {
        text: `a,b${NUL}`,
        trackIn: [],
      }).expect(400);
      const inTrackIn = await save(appId, 'en-US', {
        text: 'a',
        trackIn: [`u${NUL}`],
      }).expect(400);

      expect(messageOf(inText)).toBe('text must not contain a NUL character');
      expect(messageOf(inTrackIn)).toBe(
        'trackIn[0] must not contain a NUL character',
      );
      expect(await written()).toEqual(before);
    });

    it('E-SAV-16 answers the item the list answers', async () => {
      const appId = await seedApp();

      const saved = (
        await save(appId, 'es-MX', { text: 'uno', trackIn: ['us'] }).expect(200)
      ).body as LocalizedKeywordFieldResult;
      const listed = (
        await harness.owner.get(`/apps/${appId}/localizations`).expect(200)
      ).body as AppLocalizationsResult;

      expect(saved.localization.origin).toBe('manual');
      expect(
        listed.localizations.find((item) => item.localization === 'es-MX'),
      ).toEqual(saved.localization);
    });

    it('E-SAV-17 answers 404 for an empty save of a localization the app does not ship', async () => {
      const appId = await seedApp();

      const response = await save(appId, 'fr', {
        text: '',
        trackIn: [],
      }).expect(404);

      expect(messageOf(response)).toBe(
        "French is not one of this app's localizations",
      );
      expect((await written()).localizations).toBe(0);
    });

    it('E-SAV-18 asks for the market listing of every market it tracked in and a first score per keyword', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');

      await save(appId, 'es-MX', {
        text: 'uno,dos',
        trackIn: ['us', 'mx'],
      }).expect(200);

      const jobs = await queuedJobs();
      const refreshes = jobs.filter(
        (job) =>
          job.name === JOBS.REFRESH_APP &&
          (job.data as { appId?: string }).appId === appId,
      );
      expect(
        refreshes.map((job) => (job.data as { country?: string }).country),
      ).toEqual(['mx']);
      const keywordIds = (
        await harness.prisma.trackedKeyword.findMany({
          where: { appId, source: 'KEYWORD_FIELD' },
          select: { keywordId: true },
        })
      ).map((row) => row.keywordId);
      const scores = jobs.filter(
        (job) =>
          job.name === JOBS.SCORE_KEYWORD &&
          keywordIds.includes((job.data as { keywordId: string }).keywordId),
      );
      expect(keywordIds).toHaveLength(4);
      expect(scores).toHaveLength(4);
    });

    const processingOrder = () =>
      harness.app
        .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
        .getJobs(['wait', 'paused'], 0, -1, true);

    const fieldKeywordIds = async (appId: string, country: string) =>
      (
        await harness.prisma.trackedKeyword.findMany({
          where: {
            appId,
            source: 'KEYWORD_FIELD',
            keyword: { is: { country } },
          },
          select: { keywordId: true },
        })
      ).map((row) => row.keywordId);

    it('E-SAV-20 checks the first position of every phrase it tracked, ahead of its score', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'de');

      await save(appId, 'de', {
        text: 'fokus timer,lernen',
        trackIn: ['de'],
      }).expect(200);

      const jobs = await processingOrder();
      const keywordIds = await fieldKeywordIds(appId, 'de');
      expect(keywordIds).toHaveLength(2);
      for (const keywordId of keywordIds) {
        const check = jobs.findIndex(
          (job) =>
            job.id === firstRunCheckJobId(appId, keywordId, utcDateKey()),
        );
        const score = jobs.findIndex(
          (job) =>
            job.name === JOBS.SCORE_KEYWORD &&
            (job.data as { keywordId: string }).keywordId === keywordId,
        );
        expect(check).toBeGreaterThanOrEqual(0);
        expect(check).toBeLessThan(score);
      }
    });

    it('E-SAV-21 checks nothing for a phrase the app already tracks in that market', async () => {
      const appId = await seedApp();
      await trackActive(appId, 'de', ['lernen']);

      await save(appId, 'de', { text: 'lernen', trackIn: ['de'] }).expect(200);

      const [keywordId] = (
        await harness.prisma.keyword.findMany({
          where: { country: 'de', text: 'lernen' },
          select: { id: true },
        })
      ).map((row) => row.id);
      expect(keywordId).toBeDefined();
      const jobs = await processingOrder();
      expect(
        jobs.some(
          (job) =>
            job.name === JOBS.SCORE_KEYWORD &&
            (job.data as { keywordId: string }).keywordId === keywordId,
        ),
      ).toBe(true);
      const checks = jobs.filter(
        (job) => job.id === firstRunCheckJobId(appId, keywordId, utcDateKey()),
      );
      expect(checks).toEqual([]);
    });

    it('E-SAV-19 refuses a competitor app and writes nothing', async () => {
      const rival = await seedCompetitor(await seedApp());

      const response = await save(rival, 'en-US', {
        text: 'uno,dos',
        trackIn: ['us'],
      }).expect(400);

      expect(messageOf(response)).toBe(COMPETITOR_REFUSAL);
      await expect(written()).resolves.toEqual({
        fields: 0,
        localizations: 0,
        tracked: 0,
      });
    });
  });

  describe('preview', () => {
    const preview = (appId: string, localization: string, body: object) =>
      harness.owner
        .post(`/apps/${appId}/keyword-fields/${localization}/preview`)
        .send(body);

    const previewed = async (
      appId: string,
      localization: string,
      text: string,
    ) =>
      (await preview(appId, localization, { text }).expect(200))
        .body as KeywordFieldSavePreview;

    const counts = async () => ({
      keywords: await harness.prisma.keyword.count(),
      tracked: await harness.prisma.trackedKeyword.count(),
      fields: await harness.prisma.keywordField.count(),
      localizations: await harness.prisma.appLocalization.count(),
    });

    it('E-PRV-ASTRAL-01 counts a phrase of 51 characters outside the bmp as 51', async () => {
      const appId = await seedApp();

      await expect(
        previewed(appId, 'en-US', String.fromCodePoint(STEM[0]).repeat(51)),
      ).resolves.toMatchObject({ charactersUsed: 51 });
    });

    it('E-PRV-01 writes nothing, not even a keyword row', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');
      const before = await counts();

      await previewed(appId, 'es-MX', 'nunca,visto,antes');

      expect(await counts()).toEqual(before);
    });

    it('E-PRV-02 reports new phrases, keyword markets and daily requests per market', async () => {
      const appId = await seedApp();
      await withMarkets(appId, 'mx');
      await trackActive(appId, 'us', ['uno']);
      const other = await seedApp('other');
      await trackActive(other, 'mx', ['dos']);

      const result = await previewed(appId, 'es-MX', 'uno,dos,tres');

      expect(result.markets).toEqual([
        {
          country: 'us',
          role: 'additional',
          home: true,
          newPhrases: ['dos', 'tres'],
          keywordMarkets: 2,
          dailyRequests: 2,
        },
        {
          country: 'mx',
          role: 'default',
          home: false,
          newPhrases: ['uno', 'dos', 'tres'],
          keywordMarkets: 2,
          dailyRequests: 2,
        },
      ]);
    });

    it('E-PRV-03 reports what the field adds and drops against the stored field', async () => {
      const appId = await seedApp();
      await harness.prisma.keywordField.create({
        data: {
          appId,
          workspaceId: WORKSPACE,
          localization: 'es-MX',
          phrases: ['uno', 'viejo'],
        },
      });
      await harness.prisma.appLocalization.create({
        data: {
          appId,
          workspaceId: WORKSPACE,
          localization: 'es-MX',
          origin: 'manual',
        },
      });

      await expect(previewed(appId, 'es-MX', 'uno,dos')).resolves.toMatchObject(
        {
          localization: 'es-MX',
          phrases: ['uno', 'dos'],
          added: ['dos'],
          dropped: ['viejo'],
        },
      );
    });

    it('E-PRV-04 reports the characters used and the duplicates removed', async () => {
      const appId = await seedApp();

      await expect(
        previewed(appId, 'en-US', 'uno, uno,dos'),
      ).resolves.toMatchObject({
        duplicatesRemoved: 1,
        charactersUsed: 7,
        charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      });
    });

    it('E-PRV-05 reports the keyword limit of the plan like the import preview', async () => {
      await resetBillingState(harness, { plan: 'indie', trialEndsAt: null });
      const limit = PLAN_LIMITS.indie.keywordMarkets as number;
      const appId = await seedApp();
      await trackActive(
        appId,
        'us',
        Array.from({ length: limit - 2 }, (_, index) => `filler ${index}`),
      );

      await expect(previewed(appId, 'en-US', 'uno')).resolves.toMatchObject({
        quota: { used: limit - 2, limit, upgradeTo: 'ultimate' },
      });

      await resetBillingState(harness, { plan: 'ultimate', trialEndsAt: null });
      const ultimate = await previewed(appId, 'en-US', 'uno');
      expect(ultimate.quota?.upgradeTo).toBeNull();
    });

    it('E-PRV-06 lets a read only token preview', async () => {
      const appId = await seedApp();

      await request(harness.app.getHttpServer())
        .post(`/apps/${appId}/keyword-fields/en-US/preview`)
        .set('Authorization', `Bearer ${harness.memberToken}`)
        .send({ text: 'uno' })
        .expect(200);
    });

    it('E-PRV-07 answers 402 for a workspace without a plan in force', async () => {
      await resetBillingState(harness, {
        plan: 'free',
        trialEndsAt: new Date(Date.now() - 1_000),
      });
      const appId = await seedApp();

      await preview(appId, 'en-US', { text: 'uno' }).expect(402);
    });

    it('E-PRV-08 refuses a field over 100 characters and a bad body', async () => {
      const appId = await seedApp();

      const oversized = await preview(appId, 'en-US', {
        text: OVERSIZED,
      }).expect(400);
      await preview(appId, 'en-US', {}).expect(400);
      await preview(appId, 'en-US', { text: 5 }).expect(400);
      const unknown = await preview(appId, 'xx', { text: 'uno' }).expect(400);

      expect(messageOf(oversized)).toBe('Keyword field exceeds 100 characters');
      expect(messageOf(unknown)).toBe('Unknown App Store localization: xx');
    });

    it('E-PRV-09 refuses a Google Play app and a missing app', async () => {
      const appId = await seedApp('play', Store.GOOGLE_PLAY);

      const response = await preview(appId, 'en-US', { text: 'uno' }).expect(
        400,
      );

      expect(messageOf(response)).toBe(
        'The keyword field is only available for App Store apps',
      );
      await preview('missing-app', 'en-US', { text: 'uno' }).expect(404);
    });

    it('E-PRV-10 counts a paused phrase as new', async () => {
      const appId = await seedApp();
      await trackActive(appId, 'us', ['uno']);
      await harness.prisma.trackedKeyword.updateMany({
        where: { appId },
        data: { active: false },
      });

      const [us] = (await previewed(appId, 'en-US', 'uno')).markets;

      expect(us.newPhrases).toContain('uno');
      expect(us.keywordMarkets).toBe(1);
    });

    it('E-PRV-11 answers no market for a localization no market of the app reads', async () => {
      const appId = await seedApp();

      await expect(previewed(appId, 'pl', 'raz,dwa')).resolves.toMatchObject({
        markets: [],
        added: ['raz', 'dwa'],
        dropped: [],
      });
    });

    it('E-PRV-12 refuses a NUL character in the text', async () => {
      const appId = await seedApp();

      const response = await preview(appId, 'en-US', {
        text: `a${NUL}`,
      }).expect(400);

      expect(messageOf(response)).toBe('text must not contain a NUL character');
    });

    it('E-PRV-13 refuses a competitor app', async () => {
      const rival = await seedCompetitor(await seedApp());

      const response = await preview(rival, 'en-US', { text: 'uno' }).expect(
        400,
      );

      expect(messageOf(response)).toBe(COMPETITOR_REFUSAL);
    });
  });
});
