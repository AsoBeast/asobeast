import './helpers/enable-billing';
import { ApiErrorEnvelope, AppDetail, PLAN_LIMITS } from '@asobeast/shared';
import { Store } from '@prisma/client';
import { OnDemandLimiter } from '../src/auth/on-demand.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  CapacityHarness,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { RIVAL_URL } from './helpers/mcp-fixtures';

const IMPORT_LIMIT = PLAN_LIMITS.indie.onDemand?.importApp.limit ?? 0;
const APP_LIMIT = PLAN_LIMITS.indie.apps ?? 0;

describe('App import capacity (e2e)', () => {
  jest.setTimeout(120_000);

  let harness: CapacityHarness;
  let owner: OwnerAgent;

  const importApp = (url = RIVAL_URL) => owner.post('/apps').send({ url });

  const importAndDelete = async () => {
    const imported = await importApp().expect(201);
    await owner.delete(`/apps/${(imported.body as AppDetail).id}`).expect(204);
  };

  beforeAll(async () => {
    harness = await startCapacityHarness();
  }, 60_000);

  beforeEach(async () => {
    owner = await resetCapacity(harness);
  });

  afterAll(() => stopCapacityHarness(harness));

  it('refuses an import once the plan allowance is spent, however often the app is deleted in between', async () => {
    for (let imported = 0; imported < IMPORT_LIMIT; imported += 1) {
      await importAndDelete();
    }

    const refused = await importApp().expect(429);

    const envelope = refused.body as ApiErrorEnvelope;
    expect(envelope.rateLimit).toEqual({
      window: 'day',
      rateClass: 'store',
      plan: 'indie',
      limit: IMPORT_LIMIT,
      resetSeconds: envelope.retryAfterSeconds,
      upgradeTo: 'ultimate',
      action: 'importApp',
    });
    expect(envelope.message).toMatch(
      /^Import app limit reached: the indie plan allows \d+ requests per day\./,
    );
    expect(await harness.prisma.app.count()).toBe(0);
  });

  it('spends nothing on an app the workspace already tracks', async () => {
    await importApp().expect(201);
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    await importApp().expect(201);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(calls).toBe(0);
  });

  it('spends nothing on an import the app quota refuses', async () => {
    await harness.prisma.app.createMany({
      data: Array.from({ length: APP_LIMIT }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: `66600${index}`,
        country: 'us',
      })),
    });
    const consume = jest.spyOn(harness.app.get(OnDemandLimiter), 'consume');

    await importApp().expect(403);
    const calls = consume.mock.calls.length;
    consume.mockRestore();

    expect(calls).toBe(0);
  });
});
