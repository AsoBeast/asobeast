import { Store } from '@prisma/client';
import { HOME_LISTING, listingIn } from '../apps/listing';
import { PrismaService } from '../prisma/prisma.service';
import { StoreNotSupportedError } from '../store-providers/errors';
import { StoreProviderRegistry } from '../store-providers/store-provider.registry';
import { CompetitorSearchPlanner } from './competitor-search.planner';
import { SuggestionRequest } from './suggestion-request';

const request = (
  overrides: Partial<SuggestionRequest> = {},
): SuggestionRequest => ({
  appId: 'app1',
  limit: 30,
  tracked: new Set(),
  market: { store: Store.APP_STORE, country: 'de', storeAppId: 'store1' },
  languages: { home: ['en'], market: ['de'] },
  ...overrides,
});

const COMPETITORS = [
  { id: 'rival-a', name: 'Streaks', country: 'us' },
  { id: 'rival-b', name: 'Habitica', country: 'us' },
];

const listing = (title: string, subtitle: string | null = null) => ({
  title,
  subtitle,
  summary: null,
});

const buildPlanner = ({
  competitors = COMPETITORS,
  snapshots = (): unknown => null,
  suggest = jest.fn().mockResolvedValue([]),
  get,
}: {
  competitors?: typeof COMPETITORS;
  snapshots?: (where: Record<string, unknown>) => unknown;
  suggest?: jest.Mock;
  get?: jest.Mock;
} = {}) => {
  const prisma = {
    app: { findMany: jest.fn().mockResolvedValue(competitors) },
    appSnapshot: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(snapshots(where)),
      ),
    },
  };
  const registry = { get: get ?? jest.fn().mockReturnValue({ suggest }) };
  return {
    prisma,
    registry,
    suggest,
    planner: new CompetitorSearchPlanner(
      prisma as unknown as PrismaService,
      registry as unknown as StoreProviderRegistry,
    ),
  };
};

const sharedTitles = (where: Record<string, unknown>) =>
  where.appId === 'rival-a'
    ? listing('Streaks: Habit Tracker')
    : listing('Habit Tracker & Goals');

describe('CompetitorSearchPlanner.plan', () => {
  it('plans nothing without competitors', async () => {
    const { planner, registry } = buildPlanner({ competitors: [] });

    await expect(planner.plan(request())).resolves.toBeNull();
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('plans nothing when no competitor has a listing', async () => {
    const { planner, registry } = buildPlanner();

    await expect(planner.plan(request())).resolves.toBeNull();
    expect(registry.get).not.toHaveBeenCalled();
  });

  it('plans nothing when the competitors share no seed', async () => {
    const { planner } = buildPlanner({
      snapshots: (where) =>
        listing(where.appId === 'rival-a' ? 'Streaks' : 'Habitica'),
    });

    await expect(planner.plan(request())).resolves.toBeNull();
  });

  it("reads each competitor's listing of the requested market first", async () => {
    const { planner, prisma } = buildPlanner({
      snapshots: (where) => {
        if (where.country !== 'de') return listing('Habit Tracker & Goals');
        return where.appId === 'rival-a'
          ? listing('Gewohnheiten Tracker: Ziele')
          : null;
      },
    });

    await planner.plan(request());

    const wheres = prisma.appSnapshot.findFirst.mock.calls.map(
      ([query]: [{ where: Record<string, unknown> }]) => query.where,
    );
    expect(wheres).toEqual([
      { appId: 'rival-a', ...listingIn('us', 'de') },
      { appId: 'rival-b', ...listingIn('us', 'de') },
      { appId: 'rival-b', ...HOME_LISTING },
    ]);
  });

  it('reads the home market once when it is the requested one', async () => {
    const { planner, prisma } = buildPlanner();

    await planner.plan(
      request({
        market: { store: Store.APP_STORE, country: 'us', storeAppId: 's' },
      }),
    );

    expect(prisma.appSnapshot.findFirst).toHaveBeenCalledTimes(2);
  });

  it('plans a lookup that asks the store only when run', async () => {
    const suggest = jest.fn().mockResolvedValue([]);
    const { planner, prisma } = buildPlanner({
      snapshots: sharedTitles,
      suggest,
    });

    const lookup = await planner.plan(request());

    expect(lookup).toEqual(expect.any(Function));
    expect(suggest).not.toHaveBeenCalled();
    prisma.app.findMany.mockClear();
    prisma.appSnapshot.findFirst.mockClear();
    await lookup?.();
    expect(suggest.mock.calls[0]).toEqual(['habit tracker', 'de']);
    expect(suggest.mock.calls.length).toBeLessThanOrEqual(5);
    expect(prisma.app.findMany).not.toHaveBeenCalled();
    expect(prisma.appSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it('answers each search with its seed', async () => {
    const suggest = jest.fn((seed: string) =>
      Promise.resolve(
        seed === 'habit tracker' ? [{ term: 'habit tracker for adhd' }] : [],
      ),
    );
    const { planner } = buildPlanner({ snapshots: sharedTitles, suggest });

    const lookup = await planner.plan(request());

    expect(await lookup?.()).toEqual([
      {
        text: 'habit tracker for adhd',
        seed: 'habit tracker',
        usedByCount: 2,
        strategy: 'competitorSearch',
      },
    ]);
  });

  it('excludes what the app tracks in the market and the competitor names', async () => {
    const suggest = jest
      .fn()
      .mockResolvedValue([
        { term: 'habit tracker app' },
        { term: 'streaks habit tracker' },
        { term: 'habit tracker kids' },
      ]);
    const { planner } = buildPlanner({ snapshots: sharedTitles, suggest });

    const lookup = await planner.plan(
      request({ tracked: new Set(['habit tracker app']) }),
    );

    expect((await lookup?.())?.map((item) => item.text)).toEqual([
      'habit tracker kids',
    ]);
  });

  it('resolves the provider after the checks', async () => {
    const get = jest.fn(() => {
      throw new StoreNotSupportedError(Store.APP_STORE);
    });
    await expect(
      buildPlanner({ competitors: [], get }).planner.plan(request()),
    ).resolves.toBeNull();
    await expect(
      buildPlanner({ snapshots: sharedTitles, get }).planner.plan(request()),
    ).rejects.toBeInstanceOf(StoreNotSupportedError);
  });
});
