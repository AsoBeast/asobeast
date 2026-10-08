import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../auth/quota.service';
import { KeywordImportService } from './keyword-import.service';
import { KeywordTracker } from './keyword-tracker';
import { MarketListingRequests } from './market-listing.requests';

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
};

const trackedRow = (
  appId: string,
  active: boolean,
  text: string,
  country = 'us',
) => ({ appId, active, keyword: { text, country } });

const build = (
  tracked: ReturnType<typeof trackedRow>[],
  usage: { limit: number | null; used: number },
) => {
  const tx = {
    trackedKeyword: {
      createMany: jest
        .fn<Promise<{ count: number }>, [{ data: unknown[] }]>()
        .mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue(app),
      count: jest.fn().mockResolvedValue(1),
    },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue(tracked) },
    keyword: {
      createMany: jest.fn(),
      findMany: jest
        .fn<Promise<{ country: string }[]>, [unknown]>()
        .mockResolvedValue([]),
    },
  };
  const quota = {
    upgradeFrom: jest.fn(() => 'ultimate'),
    usage: jest.fn().mockResolvedValue({
      plan: 'indie',
      limits: { keywordMarkets: usage.limit },
      apps: 0,
      keywordMarkets: usage.used,
    }),
    admitKeywordMarkets: jest.fn(
      (write: (client: typeof tx) => Promise<unknown>) => write(tx),
    ),
  };
  const tracker = {
    keywordIdsAcrossMarkets: jest.fn(
      (pairs: { text: string; country: string }[]) =>
        Promise.resolve(
          new Map(
            pairs.map(({ text, country }) => [
              `${country}~${text}`,
              `${country}:${text}`,
            ]),
          ),
        ),
    ),
    claimForManual: jest.fn().mockResolvedValue({ count: 0 }),
    enqueueFirstScores: jest
      .fn<Promise<void>, [string[], unknown]>()
      .mockResolvedValue(undefined),
  };
  const listings = {
    request: jest.fn<Promise<number>, [unknown, string]>().mockResolvedValue(0),
  };
  const service = new KeywordImportService(
    prisma as unknown as PrismaService,
    tracker as unknown as KeywordTracker,
    quota as unknown as QuotaService,
    listings as unknown as MarketListingRequests,
  );
  return { prisma, tx, quota, tracker, listings, service };
};

describe('KeywordImportService.preview', () => {
  it('folds the tracking of every app of the workspace into one state per phrase and market', async () => {
    const { service } = build(
      [
        trackedRow('app1', true, 'habit'),
        trackedRow('app1', false, 'streak'),
        trackedRow('other', true, 'streak'),
        trackedRow('other', true, 'focus'),
        trackedRow('other', false, 'sleep'),
      ],
      { limit: null, used: 0 },
    );

    const result = await service.preview('app1', {
      rows: ['habit', 'streak', 'focus', 'sleep'].map((keyword) => ({
        keyword,
      })),
    });

    expect(result.results.map((row) => row.status)).toEqual([
      'tracked',
      'resume',
      'new',
      'new',
    ]);
    expect(result.cost.keywordMarkets).toBe(1);
  });

  it('prices the daily listing capture of every market the app starts tracking keywords in', async () => {
    const { prisma, service } = build([], { limit: null, used: 0 });
    prisma.app.count.mockResolvedValue(3);
    prisma.keyword.findMany.mockResolvedValue([{ country: 'fr' }]);

    const result = await service.preview('app1', {
      rows: [
        { keyword: 'a1', country: 'de' },
        { keyword: 'a2', country: 'de' },
        { keyword: 'a3', country: 'fr' },
        { keyword: 'a4' },
      ],
    });

    expect(prisma.app.count).toHaveBeenCalledWith({
      where: { OR: [{ id: 'app1' }, { primaryAppId: 'app1' }] },
    });
    expect(prisma.keyword.findMany).toHaveBeenCalledWith({
      where: {
        store: Store.APP_STORE,
        country: { in: ['de', 'fr'] },
        tracked: { some: { appId: 'app1', active: true } },
      },
      select: { country: true },
      distinct: ['country'],
    });
    expect(result.cost).toEqual({
      store: Store.APP_STORE,
      keywordMarkets: 4,
      dailyRequests: 7,
    });
  });

  it('prices no listing capture when every row is in the home market', async () => {
    const { prisma, service } = build([], { limit: null, used: 0 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }],
    });

    expect(prisma.keyword.findMany).not.toHaveBeenCalled();
    expect(result.cost.dailyRequests).toBe(1);
  });

  it('reads the room from the keyword market limit and the usage', async () => {
    const { service } = build([], { limit: 10, used: 8 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }, { keyword: 'a2' }, { keyword: 'a3' }],
    });

    expect(result.results.map((row) => row.status)).toEqual([
      'new',
      'new',
      'overQuota',
    ]);
    expect(result.quota).toEqual({
      used: 8,
      limit: 10,
      upgradeTo: 'ultimate',
    });
  });

  it('reports no quota and no refusal when the plan has no keyword limit', async () => {
    const { service } = build([], { limit: null, used: 0 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }],
    });

    expect(result.quota).toBeNull();
    expect(result.summary.overQuota).toBe(0);
  });

  it('writes nothing', async () => {
    const { prisma, listings, service } = build([], { limit: null, used: 0 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }],
    });

    expect(result).toMatchObject({ dryRun: true, imported: 0 });
    expect(prisma.keyword.createMany).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
  });
});

describe('KeywordImportService.import', () => {
  it('creates a new keyword with its tags and note as a manual, active keyword', async () => {
    const { tx, service } = build([], { limit: null, used: 0 });
    tx.trackedKeyword.createMany.mockResolvedValue({ count: 1 });

    const result = await service.import('app1', {
      rows: [{ keyword: 'Habit Builder', tags: ['Core'], note: ' Q4 ' }],
    });

    expect(tx.trackedKeyword.createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: 'app1',
          keywordId: 'us:habit builder',
          source: 'MANUAL',
          active: true,
          tags: ['core'],
          note: 'Q4',
        },
      ],
      skipDuplicates: true,
    });
    expect(result).toMatchObject({ dryRun: false, imported: 1 });
  });

  it('resumes a paused keyword without touching its tags or note', async () => {
    const { tx, service } = build([trackedRow('app1', false, 'streak')], {
      limit: null,
      used: 0,
    });
    tx.trackedKeyword.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.import('app1', {
      rows: [{ keyword: 'streak', tags: ['x'], note: 'y' }],
    });

    expect(tx.trackedKeyword.updateMany).toHaveBeenCalledWith({
      where: { appId: 'app1', active: false, keywordId: { in: ['us:streak'] } },
      data: { active: true },
    });
    expect(tx.trackedKeyword.createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true,
    });
    expect(result.imported).toBe(1);
  });

  it('asks once for the listing of every market the import tracks in', async () => {
    const { listings, service } = build([trackedRow('app1', false, 'a4')], {
      limit: null,
      used: 0,
    });

    await service.import('app1', {
      rows: [
        { keyword: 'a1', country: 'pl' },
        { keyword: 'a2', country: 'de' },
        { keyword: 'a3', country: 'de' },
        { keyword: 'a4' },
      ],
    });

    expect(listings.request.mock.calls).toEqual([
      [app, 'pl'],
      [app, 'de'],
      [app, 'us'],
    ]);
  });

  it('writes nothing, and skips the transaction, when no row is importable', async () => {
    const { quota, tracker, listings, service } = build(
      [trackedRow('app1', true, 'habit')],
      { limit: null, used: 0 },
    );

    const result = await service.import('app1', {
      rows: [{ keyword: 'habit' }, { keyword: '' }],
    });

    expect(result.imported).toBe(0);
    expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
    expect(tracker.enqueueFirstScores).not.toHaveBeenCalled();
    expect(listings.request).not.toHaveBeenCalled();
  });

  it('writes only the rows that fit, looks every market up at once and queues the first scores in one batch', async () => {
    const { tx, tracker, service } = build([], { limit: 10, used: 8 });
    tx.trackedKeyword.createMany.mockResolvedValue({ count: 2 });

    const result = await service.import('app1', {
      rows: [
        { keyword: 'a1', country: 'pl' },
        { keyword: 'a2', country: 'de' },
        { keyword: 'a3', country: 'de' },
      ],
    });

    expect(result.results.map((row) => row.status)).toEqual([
      'new',
      'new',
      'overQuota',
    ]);
    expect(tracker.keywordIdsAcrossMarkets).toHaveBeenCalledTimes(1);
    expect(tracker.keywordIdsAcrossMarkets).toHaveBeenCalledWith(
      [
        { text: 'a1', country: 'pl' },
        { text: 'a2', country: 'de' },
      ],
      Store.APP_STORE,
    );
    expect(tx.trackedKeyword.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tracker.enqueueFirstScores).toHaveBeenCalledTimes(1);
    expect(tracker.enqueueFirstScores).toHaveBeenCalledWith(
      ['pl:a1', 'de:a2'],
      app,
    );
  });

  it('reports the keyword markets in use after the import, not before it', async () => {
    const { tx, quota, service } = build([], { limit: 10, used: 8 });
    tx.trackedKeyword.createMany.mockResolvedValue({ count: 2 });
    quota.usage.mockResolvedValueOnce({
      plan: 'indie',
      limits: { keywordMarkets: 10 },
      apps: 0,
      keywordMarkets: 8,
    });
    quota.usage.mockResolvedValueOnce({
      plan: 'indie',
      limits: { keywordMarkets: 10 },
      apps: 0,
      keywordMarkets: 10,
    });

    const result = await service.import('app1', {
      rows: [{ keyword: 'a1' }, { keyword: 'a2' }, { keyword: 'a3' }],
    });

    expect(result.imported).toBe(2);
    expect(result.summary.overQuota).toBe(1);
    expect(result.quota).toEqual({
      used: 10,
      limit: 10,
      upgradeTo: 'ultimate',
    });
  });
});
