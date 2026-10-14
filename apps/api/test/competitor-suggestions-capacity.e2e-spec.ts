import './helpers/enable-billing';
import { ApiErrorEnvelope, PLAN_LIMITS } from '@asobeast/shared';
import { Store } from '@prisma/client';
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

  it('refuses the list once the hourly store lookup allowance is spent', async () => {
    for (let used = 0; used < LOOKUP_LIMIT; used += 1) {
      await clearRateLimitCounters(harness.app);
      await suggest().expect(200);
    }
    await clearRateLimitCounters(harness.app);

    const refused = await suggest().expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toMatchObject({
      window: 'hour',
      rateClass: 'store',
      action: 'storeLookup',
    });
    expect(envelope.message).toMatch(/^Store lookup limit reached/);
  });
});
