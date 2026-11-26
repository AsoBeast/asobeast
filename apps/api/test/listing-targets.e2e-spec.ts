import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  CURRENT_FORMULA_VERSIONS,
  ListingTargetsResult,
} from '@asobeast/shared';
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
});
