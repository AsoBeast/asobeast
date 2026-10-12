import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppLocalizationsResult,
  KEYWORD_FIELD_CHAR_LIMIT,
  LocalizedKeywordFieldResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import request from 'supertest';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

const NUL = '\u0000';

const OVERSIZED = Array.from(
  { length: 12 },
  (_, index) => `phrase ${String(index).padStart(2, '0')}`,
).join(',');

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
  });
});
