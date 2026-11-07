import { Store } from '@prisma/client';
import { QuotaExceededError } from '../auth/quota.errors';
import { QuotaService } from '../auth/quota.service';
import { FirstPositionChecks } from '../keywords/first-position-checks';
import { KeywordTracker } from '../keywords/keyword-tracker';
import { MarketListingRequests } from '../keywords/market-listing.requests';
import { PrismaService } from '../prisma/prisma.service';
import { TrackRow } from './discovery-track-plan';
import { DiscoveryTracker } from './discovery-tracker.service';

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
};

const TODAY = '2026-11-05';

const row = (overrides: Partial<TrackRow> = {}): TrackRow => ({
  keywordId: 'k1',
  text: 'habit tracker',
  country: 'us',
  source: 'reviews',
  position: null,
  depth: null,
  checkedOn: null,
  ...overrides,
});

interface RankingRow {
  keywordId: string;
  position: number | null;
  depth: number;
}

const build = (created = 1, limit: number | null = null) => {
  const tx = {
    trackedKeyword: {
      createMany: jest.fn().mockResolvedValue({ count: created }),
    },
    keywordDiscovery: {
      findMany: jest.fn().mockResolvedValue([{ keywordId: 'k1' }]),
    },
    keywordRanking: {
      createMany: jest
        .fn<Promise<unknown>, [{ data: RankingRow[] }]>()
        .mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    trackedKeyword: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const quota = {
    usage: jest.fn().mockResolvedValue({
      limits: { keywordMarkets: limit },
      keywordMarkets: 0,
    }),
    admitKeywordMarkets: jest.fn(
      (write: (client: typeof tx) => Promise<unknown>) => write(tx),
    ),
  };
  const tracker = {
    enqueueFirstScores: jest.fn().mockResolvedValue(undefined),
  };
  const checks = { schedule: jest.fn().mockResolvedValue(0) };
  const listings = { request: jest.fn().mockResolvedValue(0) };
  const service = new DiscoveryTracker(
    prisma as unknown as PrismaService,
    quota as unknown as QuotaService,
    tracker as unknown as KeywordTracker,
    checks as unknown as FirstPositionChecks,
    listings as unknown as MarketListingRequests,
  );
  return { service, tx, quota, tracker, checks, listings };
};

describe('DiscoveryTracker', () => {
  it('creates the tracked rows with the mapped source inside the admission', async () => {
    const { service, tx, quota } = build(2);
    await service.trackRows(
      app,
      [row(), row({ keywordId: 'k2', text: 'goals', source: 'title' })],
      TODAY,
    );
    expect(quota.admitKeywordMarkets).toHaveBeenCalledTimes(1);
    expect(tx.trackedKeyword.createMany).toHaveBeenCalledTimes(1);
    expect(tx.trackedKeyword.createMany).toHaveBeenCalledWith({
      data: [
        { appId: 'app1', keywordId: 'k1', source: 'SUGGESTED', active: true },
        { appId: 'app1', keywordId: 'k2', source: 'TITLE', active: true },
      ],
      skipDuplicates: true,
    });
  });

  it('writes the known position of a fresh observation and checks only the rest', async () => {
    const { service, tx, checks, tracker } = build(3);
    await service.trackRows(
      app,
      [
        row({ keywordId: 'k1', position: 4, depth: 50, checkedOn: TODAY }),
        row({
          keywordId: 'k2',
          text: 'goals',
          position: null,
          depth: 200,
          checkedOn: '2026-11-04',
        }),
        row({
          keywordId: 'k3',
          text: 'old',
          position: 9,
          depth: 200,
          checkedOn: '2026-11-02',
        }),
        row({ keywordId: 'k4', text: 'never' }),
      ],
      TODAY,
    );
    expect(tx.keywordRanking.createMany).toHaveBeenCalledTimes(1);
    expect(tx.keywordRanking.createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: 'app1',
          workspaceId: 'ws',
          keywordId: 'k1',
          date: new Date('2026-11-05T00:00:00.000Z'),
          position: 4,
          depth: 50,
        },
        {
          appId: 'app1',
          workspaceId: 'ws',
          keywordId: 'k2',
          date: new Date('2026-11-04T00:00:00.000Z'),
          position: null,
          depth: 200,
        },
      ],
      skipDuplicates: true,
    });
    expect(checks.schedule).toHaveBeenCalledWith('app1', ['k3', 'k4']);
    expect(tracker.enqueueFirstScores).toHaveBeenCalledWith(
      ['k1', 'k2', 'k3', 'k4'],
      app,
    );
  });

  it('schedules the deep check of a fresh capture that missed the app instead of recording it', async () => {
    const { service, tx, checks } = build(1);
    await service.trackRows(
      app,
      [row({ position: null, depth: 50, checkedOn: TODAY })],
      TODAY,
    );
    expect(tx.keywordRanking.createMany).not.toHaveBeenCalled();
    expect(checks.schedule).toHaveBeenCalledWith('app1', ['k1']);
  });

  it('requests the listing of every other market once', async () => {
    const { service, listings } = build(3);
    await service.trackRows(
      app,
      [
        row({ keywordId: 'k1', country: 'de' }),
        row({ keywordId: 'k2', text: 'b', country: 'de' }),
        row({ keywordId: 'k3', text: 'c' }),
      ],
      TODAY,
    );
    expect(listings.request).toHaveBeenCalledTimes(1);
    expect(listings.request).toHaveBeenCalledWith(app, 'de');
  });

  it('schedules nothing when no row was created', async () => {
    const { service, checks, tracker, listings } = build(0);
    const result = await service.trackRows(app, [row()], TODAY);
    expect(result).toEqual({ tracked: 0, skipped: 0 });
    expect(checks.schedule).not.toHaveBeenCalled();
    expect(tracker.enqueueFirstScores).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
  });

  it('lets a refused admission propagate and schedules nothing', async () => {
    const { service, quota, checks, tracker } = build(1);
    const refusal = new QuotaExceededError({
      resource: 'keywordMarkets',
      plan: 'indie',
      limit: 1,
      used: 1,
      requested: 1,
    } as never);
    quota.admitKeywordMarkets.mockRejectedValueOnce(refusal);
    await expect(service.trackRows(app, [row()], TODAY)).rejects.toBe(refusal);
    expect(checks.schedule).not.toHaveBeenCalled();
    expect(tracker.enqueueFirstScores).not.toHaveBeenCalled();
  });

  it('answers the created count and the rows over the room', async () => {
    const { service } = build(1, 1);
    const result = await service.trackRows(
      app,
      [row(), row({ keywordId: 'k2', text: 'b' })],
      TODAY,
    );
    expect(result).toEqual({ tracked: 1, skipped: 1 });
  });

  it('admits nothing for no rows', async () => {
    const { service, quota } = build(0);
    expect(await service.trackRows(app, [], TODAY)).toEqual({
      tracked: 0,
      skipped: 0,
    });
    expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
  });

  describe('unfit', () => {
    const ranked = [
      row({ position: 3, depth: 50, checkedOn: TODAY }),
      row({ keywordId: 'k2', text: 'goals', position: 8, depth: 50 }),
    ];

    it('counts no ranked row as unfit on a plan without a keyword limit', async () => {
      const { service, quota } = build(0, null);
      expect(await service.unfit(app, ranked)).toBe(0);
      expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
    });

    it('counts the ranked rows over the keyword room left', async () => {
      expect(await build(0, 1).service.unfit(app, ranked)).toBe(1);
      expect(await build(0, 0).service.unfit(app, ranked)).toBe(2);
      expect(await build(0, 5).service.unfit(app, ranked)).toBe(0);
    });

    it('reads no usage for no ranked rows', async () => {
      const { service, quota } = build(0, 0);
      expect(await service.unfit(app, [])).toBe(0);
      expect(quota.usage).not.toHaveBeenCalled();
    });
  });

  describe('autoTrack', () => {
    const refusal = () =>
      new QuotaExceededError({
        resource: 'keywordMarkets',
        plan: 'indie',
        limit: 1,
        used: 1,
        requested: 1,
      } as never);

    it('rechecks the dismissal and the switch inside the admission', async () => {
      const { service, tx } = build(1);
      await service.autoTrack(
        app,
        [row(), row({ keywordId: 'k2', text: 'dismissed meanwhile' })],
        TODAY,
      );
      expect(tx.keywordDiscovery.findMany).toHaveBeenCalledWith({
        where: {
          appId: 'app1',
          keywordId: { in: ['k1', 'k2'] },
          dismissedAt: null,
          app: { autoTrackRanked: true },
        },
        select: { keywordId: true },
      });
      expect(tx.trackedKeyword.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ keywordId: 'k1' })],
        }),
      );
    });

    it('creates no tracked row when the switch or the dismissal changed before the admission', async () => {
      const { service, tx, checks, tracker } = build(1);
      tx.keywordDiscovery.findMany.mockResolvedValueOnce([]);
      await service.autoTrack(app, [row()], TODAY);
      expect(tx.trackedKeyword.createMany).not.toHaveBeenCalled();
      expect(checks.schedule).not.toHaveBeenCalled();
      expect(tracker.enqueueFirstScores).not.toHaveBeenCalled();
    });

    it('never rechecks the switch for a manual track', async () => {
      const { service, tx } = build(1);
      await service.trackRows(app, [row()], TODAY);
      expect(tx.keywordDiscovery.findMany).not.toHaveBeenCalled();
    });

    it('keeps the rows as discoveries when the plan has no keyword room left', async () => {
      const { service, quota } = build(1);
      quota.admitKeywordMarkets.mockRejectedValueOnce(refusal());
      await expect(
        service.autoTrack(app, [row()], TODAY),
      ).resolves.toBeUndefined();
    });

    it('rethrows any other failure', async () => {
      const { service, quota } = build(1);
      const failure = new Error('database down');
      quota.admitKeywordMarkets.mockRejectedValueOnce(failure);
      await expect(service.autoTrack(app, [row()], TODAY)).rejects.toBe(
        failure,
      );
    });
  });
});
