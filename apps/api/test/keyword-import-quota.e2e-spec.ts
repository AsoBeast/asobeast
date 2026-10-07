import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  KeywordImportResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { QuotaService } from '../src/auth/quota.service';
import {
  resetBillingState,
  startBillingHarness,
  stopBillingHarness,
  WORKSPACE,
  type BillingHarness,
} from './helpers/billing-harness';

describe('Keyword import quota (e2e)', () => {
  let harness: BillingHarness;
  let appId: string;

  const seedTracked = async (count: number) => {
    await harness.prisma.keyword.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        text: `seeded ${index}`,
        store: Store.APP_STORE,
        country: 'us',
      })),
    });
    const keywords = await harness.prisma.keyword.findMany({
      where: { text: { startsWith: 'seeded ' } },
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

  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      keyword: `fresh ${index}`,
    }));

  beforeAll(async () => {
    harness = await startBillingHarness(false);
  }, 60_000);

  beforeEach(async () => {
    await resetBillingState(harness, { plan: 'indie', trialEndsAt: null });
    await harness.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    appId = (
      await harness.prisma.app.create({
        data: {
          workspaceId: WORKSPACE,
          store: Store.APP_STORE,
          storeAppId: 'import-quota',
          country: 'us',
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(() => stopBillingHarness(harness));

  it('E-IMP-06 fills the room in file order, refuses the rest and reports the quota', async () => {
    const limit = PLAN_LIMITS.indie.keywordMarkets as number;
    await seedTracked(limit - 2);

    const response = await harness.owner
      .post(`/apps/${appId}/keywords/import/preview`)
      .send({ rows: rows(5) })
      .expect(200);

    const result = response.body as KeywordImportResult;
    expect(result.results.map((row) => row.status)).toEqual([
      'new',
      'new',
      'overQuota',
      'overQuota',
      'overQuota',
    ]);
    expect(result.quota).toEqual({
      used: limit - 2,
      limit,
      upgradeTo: 'ultimate',
    });
    expect(result.summary.overQuota).toBe(3);
  });

  it('E-IMP-16 answers 402 for a workspace without a plan in force', async () => {
    await resetBillingState(harness, {
      plan: 'free',
      trialEndsAt: new Date(Date.now() - 1_000),
    });

    await harness.owner
      .post(`/apps/${appId}/keywords/import/preview`)
      .send({ rows: rows(1) })
      .expect(402);
  });

  it('E-IMP-14 refuses with 403 and writes nothing when the room was taken after the plan', async () => {
    const limit = PLAN_LIMITS.indie.keywordMarkets as number;
    await seedTracked(limit - 1);
    const quota = harness.app.get(QuotaService, { strict: false });
    jest.spyOn(quota, 'usage').mockResolvedValueOnce({
      plan: 'indie',
      limits: PLAN_LIMITS.indie,
      apps: 1,
      keywordMarkets: 0,
    });

    const response = await harness.owner
      .post(`/apps/${appId}/keywords/import`)
      .send({ rows: rows(3) })
      .expect(403);

    expect((response.body as ApiErrorEnvelope).quota).toMatchObject({
      resource: 'keywordMarkets',
      limit,
      used: limit - 1,
      requested: 3,
    });
    expect(
      await harness.prisma.trackedKeyword.count({
        where: { keyword: { text: { startsWith: 'fresh ' } } },
      }),
    ).toBe(0);
  });

  it('E-IMP-14 never lets two imports racing for the last slots cross the limit', async () => {
    const limit = PLAN_LIMITS.indie.keywordMarkets as number;
    await seedTracked(limit - 3);

    const [first, second] = await Promise.all(
      ['alpha', 'delta'].map((prefix) =>
        harness.owner.post(`/apps/${appId}/keywords/import`).send({
          rows: Array.from({ length: 3 }, (_, index) => ({
            keyword: `${prefix} ${index}`,
          })),
        }),
      ),
    );

    expect(
      [first.status, second.status].every(
        (status) => status === 200 || status === 403,
      ),
    ).toBe(true);
    expect(
      await harness.prisma.trackedKeyword.count({ where: { active: true } }),
    ).toBeLessThanOrEqual(limit);
  });

  it('E-IMP-20 answers 402 on the import for a workspace without a plan in force', async () => {
    await resetBillingState(harness, {
      plan: 'free',
      trialEndsAt: new Date(Date.now() - 1_000),
    });

    await harness.owner
      .post(`/apps/${appId}/keywords/import`)
      .send({ rows: rows(1) })
      .expect(402);
  });
});
