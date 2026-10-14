import './helpers/enable-billing';
import { Store } from '@prisma/client';
import {
  ApiErrorEnvelope,
  KeywordSuggestionStrategy,
  PLAN_LIMITS,
} from '@asobeast/shared';
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

const SUGGESTIONS_LIMIT = PLAN_LIMITS.indie.onDemand?.suggestions.limit ?? 0;

describe('Keyword suggestions capacity (e2e)', () => {
  jest.setTimeout(60_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;
  let appId: string;

  const suggest = (strategy: KeywordSuggestionStrategy, id = appId) =>
    owner.get(`/apps/${id}/keywords/suggestions`).query({ strategy });

  const spendsDuring = async (
    strategy: KeywordSuggestionStrategy,
  ): Promise<number> => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      suggest(strategy).expect(200),
    );
    return calls;
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
    appId = (
      await harness.prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: '555000111',
          country: 'us',
          name: 'Focus Timer',
        },
      })
    ).id;
    await harness.prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Focus Timer',
        subtitle: 'Pomodoro study planner',
        description: 'Deep work sessions',
        raw: {},
      },
    });
  });

  afterAll(() => stopCapacityHarness(harness));

  it('spends nothing for the metadata strategy', async () => {
    expect(await spendsDuring('metadata')).toBe(0);
  });

  it('spends nothing for the competitors, seasonal and reviews strategies', async () => {
    for (const strategy of ['competitors', 'seasonal', 'reviews'] as const) {
      expect(await spendsDuring(strategy)).toBe(0);
    }
  });

  it('spends one lookup for each strategy that reaches the store', async () => {
    for (const strategy of ['similar', 'search', 'developer'] as const) {
      expect(await spendsDuring(strategy)).toBe(1);
    }
  });

  it('spends nothing for an unknown app', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      suggest('similar', 'no-such-app').expect(404),
    );

    expect(calls).toBe(0);
  });

  it('refuses the similar strategy once the hourly allowance is spent and still answers the metadata strategy', async () => {
    for (let used = 0; used < SUGGESTIONS_LIMIT; used += 1) {
      await clearRateLimitCounters(harness.app);
      await suggest('similar').expect(200);
    }

    await clearRateLimitCounters(harness.app);
    const refused = await suggest('similar').expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toMatchObject({
      window: 'hour',
      action: 'suggestions',
    });
    await suggest('metadata').expect(200);
  });
});
