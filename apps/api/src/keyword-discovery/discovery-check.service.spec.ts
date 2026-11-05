import { Store } from '@prisma/client';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { utcToday } from '../rankings/rankings.support';
import { SerpCapture } from '../rankings/serp-capture';
import { PrismaService } from '../prisma/prisma.service';
import { ImplausibleResultError } from '../store-providers/errors';
import { SearchItem } from '../store-providers/types';
import { DiscoveryCheck } from './discovery-check.service';
import { DiscoveryTracker } from './discovery-tracker.service';

jest.mock('../keywords/listing-facts', () => ({
  listingFacts: jest.fn(() =>
    Promise.resolve({ snapshotText: 'habit tracker', marketTexts: new Map() }),
  ),
}));

const payload = { appId: 'app1', keywordId: 'k1', workspaceId: 'ws' };

const results = (count: number, appAt?: number): SearchItem[] =>
  Array.from({ length: count }, (_, index) => ({
    storeAppId: index + 1 === appAt ? '42' : `other-${index}`,
    title: `App ${index}`,
  }));

interface Fixture {
  autoTrackRanked?: boolean;
  delistedAt?: Date | null;
  unlistedMarkets?: string[];
  missing?: boolean;
  trackers?: number;
}

const build = (fixture: Fixture = {}) => {
  const row = {
    appId: 'app1',
    keywordId: 'k1',
    source: 'reviews',
    keyword: {
      id: 'k1',
      text: 'habit tracker',
      store: Store.APP_STORE,
      country: 'us',
    },
    app: {
      id: 'app1',
      workspaceId: 'ws',
      store: Store.APP_STORE,
      country: 'us',
      storeAppId: '42',
      delistedAt: fixture.delistedAt ?? null,
      unlistedMarkets: fixture.unlistedMarkets ?? [],
      autoTrackRanked: fixture.autoTrackRanked ?? false,
    },
  };
  const prisma = {
    keywordDiscovery: {
      findFirst: jest.fn().mockResolvedValue(fixture.missing ? null : row),
      update: jest.fn().mockResolvedValue({}),
    },
    trackedKeyword: {
      count: jest.fn().mockResolvedValue(fixture.trackers ?? 0),
    },
    keywordRanking: { upsert: jest.fn(), create: jest.fn() },
    keywordMetric: { upsert: jest.fn(), create: jest.fn() },
  };
  const capture = {
    search: jest
      .fn<Promise<SearchItem[] | null>, [unknown, boolean]>()
      .mockResolvedValue(results(200, 12)),
    store: jest.fn().mockResolvedValue([]),
  };
  const tracker = {
    autoTrack: jest.fn().mockResolvedValue(undefined),
  };
  const crossTenant = {
    becauseThisWorkIsNotOwnedByOneWorkspace: jest.fn(
      (_: string, work: () => Promise<unknown>) => work(),
    ),
  };
  const check = new DiscoveryCheck(
    prisma as unknown as PrismaService,
    capture as unknown as SerpCapture,
    tracker as unknown as DiscoveryTracker,
    crossTenant as unknown as CrossTenantAccess,
  );
  return { check, prisma, capture, tracker, crossTenant, row };
};

const updateOf = (prisma: ReturnType<typeof build>['prisma']) =>
  (
    prisma.keywordDiscovery.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ]
  )[0].data;

describe('DiscoveryCheck', () => {
  it('only reads open rows of the app', async () => {
    const { check, prisma } = build();
    await check.run(payload, false);
    expect(prisma.keywordDiscovery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app1',
          keywordId: 'k1',
          dismissedAt: null,
          keyword: { tracked: { none: { appId: 'app1' } } },
        },
      }),
    );
  });

  it('searches nothing for a missing, dismissed or tracked row', async () => {
    const { check, capture } = build({ missing: true });
    await check.run(payload, false);
    expect(capture.search).not.toHaveBeenCalled();
  });

  it.each<[string, Fixture]>([
    ['a delisted app', { delistedAt: new Date() }],
    ['a market the app is not sold in', { unlistedMarkets: ['us'] }],
  ])('searches nothing for %s', async (_, fixture) => {
    const { check, capture, prisma } = build(fixture);
    await check.run(payload, false);
    expect(capture.search).not.toHaveBeenCalled();
    expect(prisma.keywordDiscovery.update).not.toHaveBeenCalled();
  });

  it('records the position the search found to depth 200', async () => {
    const { check, prisma } = build();
    await check.run(payload, false);
    expect(updateOf(prisma)).toEqual({
      position: 12,
      depth: 200,
      checkedOn: utcToday(),
      relevance: 70,
    });
  });

  it('records a search without the app as checked and not found', async () => {
    const { check, prisma, capture } = build();
    capture.search.mockResolvedValueOnce(results(60));
    await check.run(payload, false);
    expect(updateOf(prisma)).toMatchObject({
      position: null,
      depth: 200,
      checkedOn: utcToday(),
    });
  });

  it('leaves the row as it was when the search settled empty', async () => {
    const { check, prisma, capture } = build();
    capture.search.mockResolvedValueOnce(null);
    await expect(check.run(payload, true)).resolves.toBeUndefined();
    expect(prisma.keywordDiscovery.update).not.toHaveBeenCalled();
  });

  it('lets an implausibly empty answer fail an attempt that will be retried', async () => {
    const { check, capture } = build();
    const failure = new ImplausibleResultError(Store.APP_STORE, 'empty', {
      retryable: true,
    });
    capture.search.mockRejectedValueOnce(failure);
    await expect(check.run(payload, false)).rejects.toBe(failure);
    expect(capture.search).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'k1' }),
      false,
    );
  });

  it('stores the capture for a keyword nobody tracks', async () => {
    const { check, capture, crossTenant } = build();
    await check.run(payload, false);
    expect(
      crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace,
    ).toHaveBeenCalledWith(
      'a keyword nobody tracks has no entrant baseline to protect',
      expect.any(Function),
    );
    expect(capture.store).toHaveBeenCalledWith(
      'k1',
      utcToday(),
      expect.any(Array),
    );
  });

  it('stores no capture of a keyword some workspace tracks but still records the position', async () => {
    const { check, capture, prisma } = build({ trackers: 1 });
    await check.run(payload, false);
    expect(capture.store).not.toHaveBeenCalled();
    expect(updateOf(prisma)).toMatchObject({ position: 12 });
  });

  it('tracks a ranked discovery when auto track is on', async () => {
    const { check, tracker, row } = build({ autoTrackRanked: true });
    await check.run(payload, false);
    expect(tracker.autoTrack).toHaveBeenCalledTimes(1);
    expect(tracker.autoTrack).toHaveBeenCalledWith(row.app, [
      {
        keywordId: 'k1',
        text: 'habit tracker',
        country: 'us',
        source: 'reviews',
        position: 12,
        depth: 200,
        checkedOn: utcToday().toISOString().slice(0, 10),
      },
    ]);
  });

  it('tracks nothing while auto track is off or the app was not found', async () => {
    const off = build();
    await off.check.run(payload, false);
    expect(off.tracker.autoTrack).not.toHaveBeenCalled();

    const unranked = build({ autoTrackRanked: true });
    unranked.capture.search.mockResolvedValueOnce(results(60));
    await unranked.check.run(payload, false);
    expect(unranked.tracker.autoTrack).not.toHaveBeenCalled();
  });

  it('lets a failure of auto track fail the check', async () => {
    const { check, tracker } = build({ autoTrackRanked: true });
    const failure = new Error('database down');
    tracker.autoTrack.mockRejectedValueOnce(failure);
    await expect(check.run(payload, false)).rejects.toBe(failure);
  });

  it('never writes a ranking or a metric', async () => {
    const { check, prisma } = build({ autoTrackRanked: true });
    await check.run(payload, false);
    expect(prisma.keywordRanking.upsert).not.toHaveBeenCalled();
    expect(prisma.keywordRanking.create).not.toHaveBeenCalled();
    expect(prisma.keywordMetric.upsert).not.toHaveBeenCalled();
    expect(prisma.keywordMetric.create).not.toHaveBeenCalled();
  });
});
