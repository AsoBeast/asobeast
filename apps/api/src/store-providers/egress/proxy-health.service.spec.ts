import { ProxyOutcome, Store } from '@prisma/client';
import { CrossTenantAccess } from '../../common/tenancy/cross-tenant-access';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HEALTH_WINDOW_MS,
  observed,
  ProxyHealthTracker,
} from './proxy-health.service';

interface UpsertCall {
  where: unknown;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

describe('ProxyHealthTracker', () => {
  const upsert = jest.fn<Promise<void>, [UpsertCall]>();
  const findUnique = jest.fn<
    Promise<{
      successes: number;
      failures: number;
      consecutiveFailures: number;
      windowStartedAt: Date;
    } | null>,
    []
  >();

  const stored = (over: { consecutiveFailures?: number } = {}) => ({
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    windowStartedAt: new Date(),
    ...over,
  });

  const prisma = {
    proxyHealth: { upsert, findUnique },
  } as unknown as PrismaService;

  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: <T>(
      _justification: string,
      work: () => Promise<T>,
    ) => work(),
  } as unknown as CrossTenantAccess;

  const tracker = new ProxyHealthTracker(prisma, crossTenant);

  const lastUpdate = () => upsert.mock.calls.at(-1)?.[0].update ?? {};

  beforeEach(() => {
    upsert.mockReset().mockResolvedValue(undefined);
    findUnique.mockReset().mockResolvedValue(null);
  });

  it('clears the cooldown and the failure streak on a success', async () => {
    await tracker.record('e1', Store.APP_STORE, observed(ProxyOutcome.SUCCESS));

    expect(lastUpdate()).toMatchObject({
      consecutiveFailures: 0,
      cooldownUntil: null,
      lastOutcome: ProxyOutcome.SUCCESS,
    });
  });

  it('starts the failure streak at one for an endpoint with no history', async () => {
    await tracker.record(
      'e1',
      Store.APP_STORE,
      observed(ProxyOutcome.TRANSPORT),
    );

    expect(lastUpdate()).toMatchObject({ consecutiveFailures: 1 });
  });

  it('extends the cooldown as the streak grows', async () => {
    findUnique.mockResolvedValue(stored({ consecutiveFailures: 2 }));

    await tracker.record(
      'e1',
      Store.APP_STORE,
      observed(ProxyOutcome.TRANSPORT),
    );

    const update = lastUpdate();
    expect(update.consecutiveFailures).toBe(3);
    expect((update.cooldownUntil as Date).getTime()).toBeGreaterThan(
      Date.now() + 100_000,
    );
  });

  it('keeps counting inside the current window', async () => {
    findUnique.mockResolvedValue({
      successes: 4,
      failures: 1,
      consecutiveFailures: 0,
      windowStartedAt: new Date(Date.now() - 60_000),
    });

    await tracker.record('e1', Store.APP_STORE, observed(ProxyOutcome.SUCCESS));

    expect(lastUpdate()).toMatchObject({ successes: 5, failures: 1 });
  });

  it('rolls the window so the success rate stays recent', async () => {
    findUnique.mockResolvedValue({
      successes: 900,
      failures: 100,
      consecutiveFailures: 0,
      windowStartedAt: new Date(Date.now() - HEALTH_WINDOW_MS - 1),
    });

    await tracker.record('e1', Store.APP_STORE, observed(ProxyOutcome.SUCCESS));

    expect(lastUpdate()).toMatchObject({ successes: 1, failures: 0 });
  });

  it('keeps the failure streak across a window roll', async () => {
    findUnique.mockResolvedValue({
      successes: 0,
      failures: 5,
      consecutiveFailures: 5,
      windowStartedAt: new Date(Date.now() - HEALTH_WINDOW_MS - 1),
    });

    await tracker.record('e1', Store.APP_STORE, observed(ProxyOutcome.BLOCKED));

    expect(lastUpdate()).toMatchObject({
      consecutiveFailures: 6,
      failures: 1,
    });
  });

  it('counts every request a single lease observed, not the lease itself', async () => {
    await tracker.record('e1', Store.GOOGLE_PLAY, {
      successes: 15,
      failures: 2,
      outcome: ProxyOutcome.RATE_LIMITED,
    });

    expect(lastUpdate()).toMatchObject({ successes: 15, failures: 2 });
  });

  it('records the failure streak once per lease however many requests it refused', async () => {
    await tracker.record('e1', Store.GOOGLE_PLAY, {
      successes: 0,
      failures: 6,
      outcome: ProxyOutcome.BLOCKED,
    });

    expect(lastUpdate()).toMatchObject({ consecutiveFailures: 1 });
  });

  it('credits the last success of a partly refused lease', async () => {
    await tracker.record('e1', Store.GOOGLE_PLAY, {
      successes: 3,
      failures: 1,
      outcome: ProxyOutcome.BLOCKED,
    });

    expect(lastUpdate().lastSuccessAt).toEqual(expect.any(Date));
  });

  it('holds the endpoint back for the requests it has already spent', async () => {
    const pacedUntil = new Date(Date.now() + 30_000);

    await tracker.record('e1', Store.APP_STORE, {
      ...observed(ProxyOutcome.SUCCESS),
      pacedUntil,
    });

    expect(lastUpdate()).toMatchObject({ pacedUntil });
  });

  it('leaves pacing untouched when the caller does not set it', async () => {
    await tracker.record('e1', Store.APP_STORE, observed(ProxyOutcome.SUCCESS));

    expect(lastUpdate()).not.toHaveProperty('pacedUntil');
  });

  it('keeps health per store so a play block leaves apple alone', async () => {
    await tracker.record(
      'e1',
      Store.GOOGLE_PLAY,
      observed(ProxyOutcome.BLOCKED),
    );

    expect(upsert.mock.calls.at(-1)?.[0].where).toEqual({
      endpointId_store: { endpointId: 'e1', store: Store.GOOGLE_PLAY },
    });
  });
});
