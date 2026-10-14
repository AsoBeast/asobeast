import './helpers/enable-billing';
import { CompetitorSuggestions, PLAN_LIMITS } from '@asobeast/shared';
import { Store } from '@prisma/client';
import { addDays, utcToday } from '../src/analytics/analytics.support';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { clearRateLimitCounters } from './obliterate-queues';

const LOOKUP_LIMIT = PLAN_LIMITS.indie.onDemand?.storeLookup.limit ?? 0;

describe('Competitor suggestions capacity (e2e)', () => {
  jest.setTimeout(120_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let primaryId: string;

  const suggest = (appId = primaryId) =>
    owner.get(`/apps/${appId}/competitors/suggestions`);

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    const primary = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111000111',
        country: 'us',
      },
    });
    primaryId = primary.id;
  });

  afterAll(() => stopCapacityHarness(harness));

  const seedKeywordResult = async () => {
    const keyword = await harness.prisma.keyword.create({
      data: { text: 'focus timer', store: Store.APP_STORE, country: 'us' },
    });
    await harness.prisma.trackedKeyword.create({
      data: {
        appId: primaryId,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
      },
    });
    await harness.prisma.serpEntry.create({
      data: {
        keywordId: keyword.id,
        date: addDays(utcToday(), -1),
        position: 2,
        storeAppId: '333000333',
        title: 'Ranked Rival',
      },
    });
  };

  it('spends one store lookup per suggestion list', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      suggest().expect(200),
    );

    expect(calls).toBe(1);
  });

  it('spends nothing on an unknown app', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      suggest('missing-app').expect(404),
    );

    expect(calls).toBe(0);
  });

  it('spends nothing on a competitor app', async () => {
    const competitor = await harness.prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '222000222',
        country: 'us',
        isCompetitor: true,
        primaryAppId: primaryId,
      },
    });
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      suggest(competitor.id).expect(404),
    );

    expect(calls).toBe(0);
  });

  it('still answers the keyword result apps once the hourly allowance is spent', async () => {
    for (let used = 0; used < LOOKUP_LIMIT; used += 1) {
      await clearRateLimitCounters(harness.app);
      await suggest().expect(200);
    }
    await clearRateLimitCounters(harness.app);

    await seedKeywordResult();
    const spent = await suggest().expect(200);

    const body = spent.body as CompetitorSuggestions;
    expect(body.similar).toBe('unavailable');
    expect(body.items).toEqual([
      expect.objectContaining({ storeAppId: '333000333', source: 'serp' }),
    ]);
    await clearRateLimitCounters(harness.app);
    await owner
      .get('/store/search?store=APP_STORE&country=us&q=focus')
      .expect(429);
  });
});
