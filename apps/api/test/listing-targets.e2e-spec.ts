import './helpers/enable-billing';
import { getQueueToken } from '@nestjs/bullmq';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  CURRENT_FORMULA_VERSIONS,
  ListingTargetsResult,
  ListingTargetsSaveResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { Queue } from 'bullmq';
import request from 'supertest';
import { firstRunCheckJobId, QUEUES, utcDateKey } from '../src/jobs/jobs.types';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

const COMPETITOR_REFUSAL =
  'A competitor app has no localizations or keyword fields; use its primary app';
const PLAY_REFUSAL =
  'Target keywords are picked per App Store localization; Google Play has no localizations here';
const TODAY = new Date(
  `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
);

interface Seeded {
  text: string;
  traffic?: number;
  difficulty?: number;
  active?: boolean;
  keywordClass?: string;
  relevance?: number;
}

describe('Listing targets (e2e)', () => {
  let harness: BillingHarness;

  const seedApp = async (
    storeAppId = 'targets',
    store: Store = Store.APP_STORE,
  ): Promise<string> =>
    (
      await harness.prisma.app.create({
        data: { workspaceId: WORKSPACE, store, storeAppId, country: 'us' },
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

  const track = async (
    appId: string,
    country: string,
    rows: Seeded[],
  ): Promise<void> => {
    for (const row of rows) {
      const keyword = await harness.prisma.keyword.upsert({
        where: {
          text_store_country: {
            text: row.text,
            store: Store.APP_STORE,
            country,
          },
        },
        update: {},
        create: { text: row.text, store: Store.APP_STORE, country },
      });
      await harness.prisma.trackedKeyword.create({
        data: {
          appId,
          keywordId: keyword.id,
          source: 'MANUAL',
          active: row.active ?? true,
          keywordClass: row.keywordClass ?? 'generic',
          relevance: row.relevance ?? null,
        },
      });
      if (row.traffic !== undefined) {
        await harness.prisma.keywordMetric.create({
          data: {
            keywordId: keyword.id,
            date: TODAY,
            traffic: row.traffic,
            difficulty: row.difficulty ?? 3,
            formulaVersion: CURRENT_FORMULA_VERSIONS.APP_STORE,
          },
        });
      }
    }
  };

  const seedTargets = (appId: string, localization: string, slots: string[]) =>
    harness.prisma.listingTarget.create({
      data: { appId, workspaceId: WORKSPACE, localization, slots },
    });

  const read = (appId: string, localization = 'en-US') =>
    harness.owner.get(`/apps/${appId}/localizations/${localization}/targets`);

  const messageOf = (response: { body: unknown }) =>
    (response.body as ApiErrorEnvelope).message;

  const save = (appId: string, body: object, localization = 'en-US') =>
    harness.owner
      .put(`/apps/${appId}/localizations/${localization}/targets`)
      .send(body);

  const fill = async (appId: string, count: number) => {
    const texts = Array.from(
      { length: count },
      (_, index) => `filler ${index}`,
    );
    await harness.prisma.keyword.createMany({
      data: texts.map((text) => ({
        text,
        store: Store.APP_STORE,
        country: 'us',
      })),
    });
    const keywords = await harness.prisma.keyword.findMany({
      where: { text: { in: texts } },
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

  const trackedIn = async (appId: string, text: string) =>
    (
      await harness.prisma.trackedKeyword.findMany({
        where: { appId, keyword: { is: { text } } },
        select: {
          active: true,
          source: true,
          keyword: { select: { country: true } },
        },
      })
    )
      .map(({ active, source, keyword }) => ({
        country: keyword.country,
        active,
        source,
      }))
      .sort((left, right) => left.country.localeCompare(right.country));

  const storedSlots = async (appId: string, localization = 'en-US') =>
    (
      await harness.prisma.listingTarget.findUnique({
        where: { appId_localization: { appId, localization } },
        select: { slots: true },
      })
    )?.slots ?? null;

  const queuedIds = async () =>
    (
      await harness.app
        .get<Queue>(getQueueToken(QUEUES.APP_STORE), { strict: false })
        .getJobs(['waiting', 'paused', 'delayed', 'prioritized'])
    ).map((job) => job.id);

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

  describe('read', () => {
    it('answers ten empty slots and the candidates of an app without targets', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [
        { text: 'sleep sounds', traffic: 2 },
        { text: 'habit tracker', traffic: 8 },
        { text: 'rival app', traffic: 9, keywordClass: 'competitorBrand' },
        { text: 'paused one', traffic: 9, active: false },
      ]);

      const response = await read(appId).expect(200);
      const body = response.body as ListingTargetsResult;

      expect(body).toMatchObject({
        appId,
        localization: 'en-US',
        readers: ['us'],
        updatedAt: null,
      });
      expect(body.slots).toEqual(Array<null>(10).fill(null));
      expect(body.candidates.map(({ text }) => text)).toEqual([
        'habit tracker',
        'sleep sounds',
      ]);
      expect(body.candidates[0]).toMatchObject({
        markets: ['us'],
        lead: { country: 'us' },
      });
    });

    it('answers stored slots in their positions with their roles and scores', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [{ text: 'habit tracker', traffic: 8 }]);
      await seedTargets(appId, 'en-US', ['habit tracker', '', 'focus timer']);

      const body = (await read(appId).expect(200)).body as ListingTargetsResult;

      expect(body.slots[0]).toMatchObject({
        position: 1,
        role: 'title',
        text: 'habit tracker',
        untrackedIn: [],
        lead: { country: 'us' },
      });
      expect(body.slots[0]?.lead?.popularity).not.toBeNull();
      expect(body.slots[1]).toBeNull();
      expect(body.slots[2]).toMatchObject({
        position: 3,
        role: 'subtitle',
        text: 'focus timer',
        trackedIn: [],
        untrackedIn: ['us'],
        lead: null,
      });
      expect(body.updatedAt).not.toBeNull();
      expect(body.candidates).toEqual([]);
    });

    it('answers the markets reading a localization the home market does not read', async () => {
      const appId = await seedApp();
      await track(appId, 'gb', [{ text: 'seed gb' }]);
      await track(appId, 'au', [{ text: 'seed au' }]);

      const body = (await read(appId, 'en-GB').expect(200))
        .body as ListingTargetsResult;

      expect(body.readers).toEqual(['au', 'gb']);
    });

    it('answers the stored slots of a localization no market reads', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [{ text: 'kaizen' }]);
      await seedTargets(appId, 'ja', ['kaizen']);

      const body = (await read(appId, 'ja').expect(200))
        .body as ListingTargetsResult;

      expect(body.readers).toEqual([]);
      expect(body.candidates).toEqual([]);
      expect(body.slots[0]).toMatchObject({
        text: 'kaizen',
        trackedIn: [],
        untrackedIn: [],
        lead: null,
      });
    });

    it('answers a placement for each target and candidate', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [
        { text: 'habit tracker', traffic: 5.5, difficulty: 3, relevance: 80 },
        { text: 'focus', traffic: 3, difficulty: 4.5, relevance: 80 },
        { text: 'daily goals', traffic: 4, difficulty: 1, relevance: 80 },
      ]);
      await seedTargets(appId, 'en-US', ['habit tracker', 'focus']);

      const body = (await read(appId).expect(200)).body as ListingTargetsResult;

      expect(body.slots[0]?.placement).toEqual({
        field: 'title',
        reason: 'strongestReachable',
        popularity: 55,
        difficulty: 30,
        position: null,
      });
      expect(body.slots[1]?.placement).toMatchObject({
        field: 'keywordField',
        reason: 'singleWord',
      });
      expect(
        body.candidates.map(({ text, placement }) => [
          text,
          placement?.field,
          placement?.reason,
        ]),
      ).toEqual([['daily goals', 'subtitle', 'nextReachable']]);
    });

    it('answers no placement for an untracked or unscored target', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [{ text: 'habit tracker' }]);
      await seedTargets(appId, 'en-US', ['habit tracker', 'focus timer']);

      const body = (await read(appId).expect(200)).body as ListingTargetsResult;

      expect(body.slots[0]?.lead).not.toBeNull();
      expect(body.slots[0]).not.toHaveProperty('placement');
      expect(body.slots[1]?.lead).toBeNull();
      expect(body.slots[1]).not.toHaveProperty('placement');
    });

    it('answers no placement for a target of a localization no market reads', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [{ text: 'kaizen', traffic: 6, relevance: 80 }]);
      await seedTargets(appId, 'ja', ['kaizen']);

      const body = (await read(appId, 'ja').expect(200))
        .body as ListingTargetsResult;

      expect(body.slots[0]).not.toHaveProperty('placement');
    });

    it('refuses a competitor', async () => {
      const competitorId = await seedCompetitor(await seedApp());

      const response = await read(competitorId).expect(400);

      expect(messageOf(response)).toBe(COMPETITOR_REFUSAL);
    });

    it('refuses a Google Play app', async () => {
      const appId = await seedApp('com.example.targets', Store.GOOGLE_PLAY);

      const response = await read(appId).expect(400);

      expect(messageOf(response)).toBe(PLAY_REFUSAL);
    });

    it('refuses an unknown localization tag', async () => {
      const appId = await seedApp();

      await read(appId, 'xx-YY').expect(400);
    });

    it('answers 404 for an unknown app', async () => {
      await read('missing-app').expect(404);
    });
  });

  describe('save', () => {
    it('stores the slots and tracks a new phrase where the localization is read', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [{ text: 'focus timer' }]);

      const response = await save(appId, {
        slots: ['habit tracker', 'focus timer'],
      }).expect(200);
      const body = response.body as ListingTargetsSaveResult;

      expect(body).toMatchObject({ tracked: 1, notTracked: [] });
      expect(body.slots[0]).toMatchObject({
        text: 'habit tracker',
        untrackedIn: [],
      });
      expect(await storedSlots(appId)).toEqual([
        'habit tracker',
        'focus timer',
      ]);
      expect(await trackedIn(appId, 'habit tracker')).toEqual([
        { country: 'us', active: true, source: 'MANUAL' },
      ]);
      const keywordId = body.slots[0]?.trackedIn[0]?.keywordId ?? '';
      expect(await queuedIds()).toContain(
        firstRunCheckJobId(appId, keywordId, utcDateKey()),
      );
    });

    it('answers the placements of the saved targets', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [
        { text: 'habit tracker', traffic: 5.5, difficulty: 3, relevance: 80 },
        { text: 'focus', traffic: 3, difficulty: 4.5, relevance: 80 },
      ]);

      const body = (
        await save(appId, { slots: ['focus', 'habit tracker'] }).expect(200)
      ).body as ListingTargetsSaveResult;

      expect(body.slots[0]?.placement).toMatchObject({
        field: 'keywordField',
        reason: 'singleWord',
      });
      expect(body.slots[1]?.placement).toMatchObject({
        field: 'title',
        reason: 'strongestReachable',
      });
    });

    it('tracks a phrase in every market reading the localization', async () => {
      const appId = await seedApp();
      await track(appId, 'gb', [{ text: 'seed gb' }]);
      await track(appId, 'au', [{ text: 'seed au' }]);

      const body = (
        await save(appId, { slots: ['habit tracker'] }, 'en-GB').expect(200)
      ).body as ListingTargetsSaveResult;

      expect(body.tracked).toBe(2);
      expect(await trackedIn(appId, 'habit tracker')).toEqual([
        { country: 'au', active: true, source: 'MANUAL' },
        { country: 'gb', active: true, source: 'MANUAL' },
      ]);
    });

    it('resumes a paused keyword picked as a new target', async () => {
      const appId = await seedApp();
      await track(appId, 'us', [{ text: 'habit tracker', active: false }]);

      const body = (await save(appId, { slots: ['habit tracker'] }).expect(200))
        .body as ListingTargetsSaveResult;

      expect(body.tracked).toBe(1);
      expect(await trackedIn(appId, 'habit tracker')).toEqual([
        { country: 'us', active: true, source: 'MANUAL' },
      ]);
    });

    it('stores every slot and names the phrase over the keyword limit', async () => {
      await resetBillingState(harness, { plan: 'indie', trialEndsAt: null });
      const limit = PLAN_LIMITS.indie.keywordMarkets as number;
      const appId = await seedApp();
      await fill(appId, limit - 1);

      const body = (
        await save(appId, {
          slots: ['habit tracker', 'focus timer'],
        }).expect(200)
      ).body as ListingTargetsSaveResult;

      expect(body.tracked).toBe(1);
      expect(body.notTracked).toEqual([
        { text: 'focus timer', country: 'us', reason: 'keywordLimit' },
      ]);
      expect(body.quota).toMatchObject({ used: limit, limit });
      expect(await storedSlots(appId)).toEqual([
        'habit tracker',
        'focus timer',
      ]);
      expect(body.slots[1]).toMatchObject({ untrackedIn: ['us'] });
    });

    it('tracks a phrase another app tracks in the market at a full limit', async () => {
      await resetBillingState(harness, { plan: 'indie', trialEndsAt: null });
      const limit = PLAN_LIMITS.indie.keywordMarkets as number;
      const appId = await seedApp();
      const otherId = await seedApp('other');
      await track(otherId, 'us', [{ text: 'shared phrase' }]);
      await fill(appId, limit - 1);

      const body = (await save(appId, { slots: ['shared phrase'] }).expect(200))
        .body as ListingTargetsSaveResult;

      expect(body).toMatchObject({ tracked: 1, notTracked: [] });
    });

    it('stores the targets of a localization no market reads and tracks nothing', async () => {
      const appId = await seedApp();

      const body = (await save(appId, { slots: ['kaizen'] }, 'ja').expect(200))
        .body as ListingTargetsSaveResult;

      expect(body).toMatchObject({ readers: [], tracked: 0, notTracked: [] });
      expect(await storedSlots(appId, 'ja')).toEqual(['kaizen']);
      expect(await trackedIn(appId, 'kaizen')).toEqual([]);
    });

    it('keeps a paused target paused when the slots are reordered', async () => {
      const appId = await seedApp();
      await save(appId, { slots: ['habit tracker', 'focus timer'] }).expect(
        200,
      );
      await harness.prisma.trackedKeyword.updateMany({
        where: { appId, keyword: { is: { text: 'focus timer' } } },
        data: { active: false },
      });

      const body = (
        await save(appId, {
          slots: ['focus timer', 'habit tracker'],
        }).expect(200)
      ).body as ListingTargetsSaveResult;

      expect(body.tracked).toBe(0);
      expect(await trackedIn(appId, 'focus timer')).toEqual([
        { country: 'us', active: false, source: 'MANUAL' },
      ]);
      expect(body.slots[0]?.trackedIn).toEqual([
        expect.objectContaining({ country: 'us', active: false }),
      ]);
    });

    it('tracks the targets in a new reader market only when asked to', async () => {
      const appId = await seedApp();
      await save(appId, { slots: ['habit tracker', 'focus timer'] }).expect(
        200,
      );
      await track(appId, 'mx', [{ text: 'seed mx' }]);

      const unchanged = (
        await save(
          appId,
          {
            slots: ['habit tracker', 'focus timer'],
          },
          'en-US',
        ).expect(200)
      ).body as ListingTargetsSaveResult;
      expect(unchanged.tracked).toBe(0);

      await save(appId, { slots: ['habit tracker'] }, 'en-GB').expect(200);
      await harness.prisma.trackedKeyword.deleteMany({
        where: {
          appId,
          keyword: { is: { text: 'habit tracker', country: 'mx' } },
        },
      });
      const skipped = (
        await save(appId, { slots: ['habit tracker'] }, 'en-GB').expect(200)
      ).body as ListingTargetsSaveResult;
      expect(skipped.tracked).toBe(0);
      expect(skipped.slots[0]?.untrackedIn).toEqual(['mx']);

      const missing = (
        await save(
          appId,
          {
            slots: ['habit tracker'],
            trackMissing: true,
          },
          'en-GB',
        ).expect(200)
      ).body as ListingTargetsSaveResult;
      expect(missing.tracked).toBe(1);
      expect(missing.slots[0]?.untrackedIn).toEqual([]);
    });

    it('removes the row when every slot is empty', async () => {
      const appId = await seedApp();
      await save(appId, { slots: ['habit tracker'] }).expect(200);

      const body = (await save(appId, { slots: [null, null] }).expect(200))
        .body as ListingTargetsSaveResult;

      expect(await storedSlots(appId)).toBeNull();
      expect(body.updatedAt).toBeNull();
      expect(await trackedIn(appId, 'habit tracker')).toHaveLength(1);
    });

    it('refuses duplicates naming both positions', async () => {
      const appId = await seedApp();

      const response = await save(appId, {
        slots: ['focus', null, 'Focus'],
      }).expect(400);

      expect(messageOf(response)).toBe('Targets 1 and 3 are both "focus"');
      expect(await storedSlots(appId)).toBeNull();
    });

    it('refuses eleven slots', async () => {
      const appId = await seedApp();

      await save(appId, {
        slots: Array.from({ length: 11 }, (_, index) => `phrase ${index}`),
      }).expect(400);
    });

    it('refuses a slot that is neither a phrase nor null', async () => {
      const appId = await seedApp();

      await save(appId, { slots: ['ok', 42] }).expect(400);
      await save(appId, { slots: 'habit' }).expect(400);
    });

    it('refuses a competitor, a Google Play app, an unknown tag and a missing app', async () => {
      const appId = await seedApp();
      const competitorId = await seedCompetitor(appId);
      const playId = await seedApp('com.example.targets', Store.GOOGLE_PLAY);
      const body = { slots: ['habit'] };

      expect(messageOf(await save(competitorId, body).expect(400))).toBe(
        COMPETITOR_REFUSAL,
      );
      expect(messageOf(await save(playId, body).expect(400))).toBe(
        PLAY_REFUSAL,
      );
      await save(appId, body, 'xx-YY').expect(400);
      await save('missing-app', body).expect(404);
    });

    it('refuses a read only token and writes nothing', async () => {
      const appId = await seedApp();

      await request(harness.app.getHttpServer())
        .put(`/apps/${appId}/localizations/en-US/targets`)
        .set('Authorization', `Bearer ${harness.memberToken}`)
        .send({ slots: ['habit tracker'] })
        .expect(403);

      expect(await storedSlots(appId)).toBeNull();
      expect(await trackedIn(appId, 'habit tracker')).toEqual([]);
    });
  });

  describe('untrack', () => {
    const keywordIdOf = async (appId: string, text: string, country: string) =>
      (
        await harness.prisma.trackedKeyword.findFirstOrThrow({
          where: { appId, keyword: { is: { text, country } } },
          select: { keywordId: true },
        })
      ).keywordId;

    const untrack = (appId: string, keywordId: string) =>
      harness.owner.delete(`/apps/${appId}/keywords/${keywordId}`).expect(204);

    it('empties the slot of an untracked keyword without moving the next one', async () => {
      const appId = await seedApp();
      await save(appId, {
        slots: ['habit tracker', 'focus timer', 'sleep sounds'],
      }).expect(200);

      await untrack(appId, await keywordIdOf(appId, 'focus timer', 'us'));

      expect(await storedSlots(appId)).toEqual([
        'habit tracker',
        '',
        'sleep sounds',
      ]);
    });

    it('keeps the slot while another reader market still tracks the phrase', async () => {
      const appId = await seedApp();
      await track(appId, 'gb', [{ text: 'seed gb' }]);
      await track(appId, 'au', [{ text: 'seed au' }]);
      await save(appId, { slots: ['habit tracker'] }, 'en-GB').expect(200);

      await untrack(appId, await keywordIdOf(appId, 'habit tracker', 'au'));
      expect(await storedSlots(appId, 'en-GB')).toEqual(['habit tracker']);

      await untrack(appId, await keywordIdOf(appId, 'habit tracker', 'gb'));
      expect(await storedSlots(appId, 'en-GB')).toBeNull();
    });

    it('empties every slot a bulk untrack removes in one request', async () => {
      const appId = await seedApp();
      await save(appId, {
        slots: ['habit tracker', 'focus timer', 'sleep sounds'],
      }).expect(200);

      await harness.owner
        .post(`/apps/${appId}/keywords/bulk`)
        .send({
          action: 'untrack',
          keywordIds: [
            await keywordIdOf(appId, 'habit tracker', 'us'),
            await keywordIdOf(appId, 'sleep sounds', 'us'),
          ],
        })
        .expect(200);

      expect(await storedSlots(appId)).toEqual(['', 'focus timer']);
    });

    it('keeps the slot of a paused keyword', async () => {
      const appId = await seedApp();
      await save(appId, { slots: ['habit tracker'] }).expect(200);

      await harness.owner
        .post(`/apps/${appId}/keywords/bulk`)
        .send({
          action: 'pause',
          keywordIds: [await keywordIdOf(appId, 'habit tracker', 'us')],
        })
        .expect(200);

      expect(await storedSlots(appId)).toEqual(['habit tracker']);
    });

    it('leaves the targets of a localization the removed market does not read', async () => {
      const appId = await seedApp();
      await save(appId, { slots: ['kaizen'] }, 'ja').expect(200);
      await save(appId, { slots: ['kaizen'] }).expect(200);

      await untrack(appId, await keywordIdOf(appId, 'kaizen', 'us'));

      expect(await storedSlots(appId, 'ja')).toEqual(['kaizen']);
      expect(await storedSlots(appId)).toBeNull();
    });
  });
});
