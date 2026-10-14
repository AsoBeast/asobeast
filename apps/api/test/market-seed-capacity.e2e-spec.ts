import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  AppDetail,
  MarketSeedResult,
  PLAN_LIMITS,
} from '@asobeast/shared';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { WorkspaceContext } from '../src/common/tenancy/workspace-context';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { RIVAL_URL } from './helpers/mcp-fixtures';

const REFRESH_LIMIT = PLAN_LIMITS.indie.onDemand?.refresh.limit ?? 0;
const KEYWORD_LIMIT = PLAN_LIMITS.indie.keywordMarkets as number;

describe('Market seed capacity (e2e)', () => {
  jest.setTimeout(45_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;

  const seed = (country: string, id = appId) =>
    owner.post(`/apps/${id}/market-seed`).send({ country });

  const spendRefreshAllowance = () =>
    harness.app.get(WorkspaceContext).run(DEFAULT_WORKSPACE_ID, async () => {
      const limiter = harness.app.get(OnDemandLimiter);
      for (let used = 0; used < REFRESH_LIMIT; used += 1) {
        await limiter.consume('refresh');
      }
    });

  const fillKeywordRoom = async () => {
    await harness.prisma.keyword.createMany({
      data: Array.from({ length: KEYWORD_LIMIT }, (_, index) => ({
        text: `filler ${index}`,
        store: Store.APP_STORE,
        country: 'gb',
      })),
    });
    const keywords = await harness.prisma.keyword.findMany({
      where: { text: { startsWith: 'filler ' } },
      select: { id: true },
    });
    await harness.prisma.trackedKeyword.createMany({
      data: keywords.map(({ id }) => ({
        appId,
        keywordId: id,
        source: 'MANUAL' as const,
      })),
    });
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    appId = (
      (await owner.post('/apps').send({ url: RIVAL_URL }).expect(201))
        .body as AppDetail
    ).id;
  });

  afterAll(() => stopCapacityHarness(harness));

  it('spends exactly one refresh allowance for a seed that captured a listing', async () => {
    const [answer, calls] = await allowanceSpendsDuring(harness, () =>
      seed('de').expect(200),
    );

    expect((answer.body as MarketSeedResult).status).toBe('seeded');
    expect(calls).toBe(1);
  });

  it('spends nothing when the request is refused', async () => {
    const [, home] = await allowanceSpendsDuring(harness, () =>
      seed('us').expect(400),
    );
    const [, unknown] = await allowanceSpendsDuring(harness, () =>
      seed('zz').expect(400),
    );
    const [, missing] = await allowanceSpendsDuring(harness, () =>
      seed('de', 'no-such-app').expect(404),
    );

    expect([home, unknown, missing]).toEqual([0, 0, 0]);
  });

  it('refuses a seed once the refresh allowance is spent and names the action', async () => {
    await spendRefreshAllowance();

    const refused = await seed('de').expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toMatchObject({
      rateClass: 'store',
      plan: 'indie',
      limit: REFRESH_LIMIT,
      action: 'refresh',
    });
    await expect(
      harness.prisma.appSnapshot.count({ where: { country: 'de' } }),
    ).resolves.toBe(0);
  });

  it('skips the phrases the keyword room cannot hold and never answers 403', async () => {
    await fillKeywordRoom();

    const answer = await seed('de').expect(200);

    const result = answer.body as MarketSeedResult;
    expect(result.status).toBe('seeded');
    expect(result.seeded).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
    await expect(
      harness.prisma.trackedKeyword.count({
        where: { appId, keyword: { country: 'de' } },
      }),
    ).resolves.toBe(0);
  });
});
