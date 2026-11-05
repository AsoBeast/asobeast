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

interface RankingCreate {
  keywordId: string;
  position: number | null;
  depth: number;
}

const build = (created = 1, limit: number | null = null) => {
  const tx = {
    trackedKeyword: {
      createMany: jest.fn().mockResolvedValue({ count: created }),
    },
    keywordRanking: {
      upsert: jest
        .fn<Promise<unknown>, [{ create: RankingCreate }]>()
        .mockResolvedValue({}),
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
    expect(tx.keywordRanking.upsert).toHaveBeenCalledTimes(2);
    expect(tx.keywordRanking.upsert).toHaveBeenCalledWith({
      where: {
        appId_keywordId_date: {
          appId: 'app1',
          keywordId: 'k1',
          date: new Date('2026-11-05T00:00:00.000Z'),
        },
      },
      create: {
        appId: 'app1',
        workspaceId: 'ws',
        keywordId: 'k1',
        date: new Date('2026-11-05T00:00:00.000Z'),
        position: 4,
        depth: 50,
      },
      update: { position: 4, depth: 50 },
    });
    expect(
      tx.keywordRanking.upsert.mock.calls.map(
        ([{ create }]) =>
          `${create.keywordId}:${create.position}:${create.depth}`,
      ),
    ).toEqual(['k1:4:50', 'k2:null:200']);
    expect(checks.schedule).toHaveBeenCalledWith('app1', ['k3', 'k4']);
    expect(tracker.enqueueFirstScores).toHaveBeenCalledWith(
      ['k1', 'k2', 'k3', 'k4'],
      app,
    );
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
});
