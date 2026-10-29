import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  KeywordBulkResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

describe('Keyword bulk change quota (e2e)', () => {
  let harness: BillingHarness;
  let appId: string;
  const limit = PLAN_LIMITS.indie.keywordMarkets as number;

  const createApp = async (storeAppId: string) =>
    (
      await harness.prisma.app.create({
        data: {
          workspaceId: WORKSPACE,
          store: Store.APP_STORE,
          storeAppId,
          country: 'us',
        },
        select: { id: true },
      })
    ).id;

  const seedKeywords = async (prefix: string, count: number) => {
    await harness.prisma.keyword.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        text: `${prefix} ${index}`,
        store: Store.APP_STORE,
        country: 'us',
      })),
    });
    return (
      await harness.prisma.keyword.findMany({
        where: { text: { startsWith: `${prefix} ` } },
        select: { id: true },
      })
    ).map(({ id }) => id);
  };

  const trackAll = (owner: string, keywordIds: string[], active: boolean) =>
    harness.prisma.trackedKeyword.createMany({
      data: keywordIds.map((keywordId) => ({
        appId: owner,
        keywordId,
        source: 'MANUAL',
        active,
      })),
    });

  const bulk = (body: { action: string; keywordIds: string[] }) =>
    harness.owner.post(`/apps/${appId}/keywords/bulk`).send(body);

  beforeAll(async () => {
    harness = await startBillingHarness(false);
  }, 60_000);

  beforeEach(async () => {
    await resetBillingState(harness, { plan: 'indie', trialEndsAt: null });
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    appId = await createApp('bulk-quota');
  });

  afterAll(() => stopBillingHarness(harness));

  it('refuses a resume past the limit with 403 and leaves every row paused', async () => {
    await trackAll(appId, await seedKeywords('active', limit - 1), true);
    const paused = await seedKeywords('paused', 3);
    await trackAll(appId, paused, false);

    const response = await bulk({
      action: 'resume',
      keywordIds: paused,
    }).expect(403);

    expect((response.body as ApiErrorEnvelope).quota).toMatchObject({
      resource: 'keywordMarkets',
    });
    expect(
      await harness.prisma.trackedKeyword.count({
        where: { appId, keywordId: { in: paused }, active: true },
      }),
    ).toBe(0);
  });

  it('resumes keywords another app already tracks at the limit', async () => {
    const other = await createApp('bulk-quota-other');
    const shared = await seedKeywords('shared', 3);
    await trackAll(other, shared, true);
    await trackAll(appId, await seedKeywords('active', limit - 3), true);
    await trackAll(appId, shared, false);

    const response = await bulk({
      action: 'resume',
      keywordIds: shared,
    }).expect(200);

    expect((response.body as KeywordBulkResult).changed).toBe(3);
  });

  it('lets a pause and an untrack through at the limit', async () => {
    const active = await seedKeywords('active', limit);
    await trackAll(appId, active, true);

    await bulk({ action: 'pause', keywordIds: active.slice(0, 2) }).expect(200);
    await bulk({ action: 'untrack', keywordIds: active.slice(2, 4) }).expect(
      200,
    );
  });
});
