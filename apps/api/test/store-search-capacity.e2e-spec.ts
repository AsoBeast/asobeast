import './helpers/enable-billing';
import { ApiErrorEnvelope, HOUR_SECONDS, PLAN_LIMITS } from '@asobeast/shared';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { awaitWindowHeadroom } from './helpers/burn-headroom';
import {
  clearRateLimitCounters,
  spendOnDemandAllowance,
} from './obliterate-queues';

const LOOKUP_LIMIT = PLAN_LIMITS.indie.onDemand?.storeLookup.limit ?? 0;

describe('Store search capacity (e2e)', () => {
  jest.setTimeout(120_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;

  const search = (country = 'us') =>
    owner.get(`/store/search?store=APP_STORE&country=${country}&q=focus`);

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
  });

  afterAll(() => stopCapacityHarness(harness));

  it('spends one store lookup per search', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      search().expect(200),
    );

    expect(calls).toBe(1);
  });

  it('spends nothing on a search the validation refuses', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      search('usa').expect(400),
    );

    expect(calls).toBe(0);
  });

  it('spends nothing on a storefront the store does not have', async () => {
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      search('ad').expect(400),
    );

    expect(calls).toBe(0);
  });

  it('refuses a search once the hourly allowance is spent', async () => {
    await awaitWindowHeadroom(HOUR_SECONDS);
    await search().expect(200);
    expect(await spendOnDemandAllowance(harness.app, LOOKUP_LIMIT)).toBe(1);
    await clearRateLimitCounters(harness.app);

    const refused = await search().expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toEqual({
      window: 'hour',
      rateClass: 'store',
      plan: 'indie',
      limit: LOOKUP_LIMIT,
      resetSeconds: envelope.retryAfterSeconds,
      upgradeTo: 'ultimate',
      action: 'storeLookup',
    });
    expect(refused.headers['retry-after']).toBeDefined();
    expect(envelope.message).toMatch(
      /^Store lookup limit reached: the indie plan allows \d+ requests per hour\./,
    );
  });
});
