import './helpers/enable-billing';
import { ApiErrorEnvelope, AppDetail, PLAN_LIMITS } from '@asobeast/shared';
import { Store } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { KeywordsService } from '../src/keywords/keywords.service';
import { RedisUnavailableError } from '../src/redis/redis.errors';
import {
  StorePoolBusyError,
  StoreRequestError,
} from '../src/store-providers/errors';
import {
  allowanceSpendsDuring,
  CapacityHarness,
  failNextStoreLookup,
  OwnerAgent,
  resetCapacity,
  startCapacityHarness,
  stopCapacityHarness,
} from './helpers/capacity-harness';
import { RIVAL_URL } from './helpers/mcp-fixtures';
import { clearRateLimitCounters } from './obliterate-queues';

const IMPORT_LIMIT = PLAN_LIMITS.indie.onDemand?.importApp.limit ?? 0;
const APP_LIMIT = PLAN_LIMITS.indie.apps ?? 0;
const REFRESH_LIMIT = PLAN_LIMITS.indie.onDemand?.refresh.limit ?? 0;
const OTHER_URL = 'https://apps.apple.com/us/app/other/id1234567890';

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

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => stopCapacityHarness(harness));

  const spendImportsToLastOne = async () => {
    for (let imported = 1; imported < IMPORT_LIMIT; imported += 1) {
      await importAndDelete();
    }
  };

  const busyPool = () => new StorePoolBusyError(Store.APP_STORE, 3_000);

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
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      importApp().expect(201),
    );

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
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      importApp().expect(403),
    );

    expect(calls).toBe(0);
  });

  it('gives an import back when the proxy pool was busy', async () => {
    await spendImportsToLastOne();
    failNextStoreLookup(harness, busyPool());

    await importApp().expect(503);

    await importApp().expect(201);
  });

  it('keeps the charge after a store failure', async () => {
    await spendImportsToLastOne();
    failNextStoreLookup(
      harness,
      new StoreRequestError(Store.APP_STORE, 'getApp', 'fetch failed'),
    );

    await importApp().expect(502);

    await importApp().expect(429);
  });

  it('keeps the charge when queueing fails after the listing was stored', async () => {
    await spendImportsToLastOne();
    jest
      .spyOn(harness.app.get(KeywordsService), 'syncFromSnapshot')
      .mockRejectedValueOnce(new RedisUnavailableError(5));

    await importApp().expect(503);

    expect(await harness.prisma.app.count()).toBe(1);
    const [, calls] = await allowanceSpendsDuring(harness, () =>
      importApp().expect(201),
    );
    expect(calls).toBe(0);
    await importApp(OTHER_URL).expect(429);
  });

  it('gives a refresh back when the proxy pool was busy', async () => {
    const imported = await importApp().expect(201);
    const refresh = () =>
      owner.post(`/apps/${(imported.body as AppDetail).id}/refresh`);
    for (let refreshed = 1; refreshed < REFRESH_LIMIT; refreshed += 1) {
      await clearRateLimitCounters(harness.app);
      await refresh().expect(200);
    }
    failNextStoreLookup(harness, busyPool());

    await refresh().expect(503);

    await clearRateLimitCounters(harness.app);
    await refresh().expect(200);
  });
});
