import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { CaptureReading, DiscoveryCaptures } from './discovery-captures';
import { KeywordDiscoveryPlanner } from './discovery-planner.service';
import { DiscoveryPoolStore } from './discovery-pool-store';
import { DiscoveryTracker } from './discovery-tracker.service';

jest.mock('../keywords/app-markets', () => ({
  loadAppMarkets: jest.fn(() => Promise.resolve(['us', 'de'])),
}));
jest.mock('../keywords/listing-facts', () => ({
  listingFacts: jest.fn(() =>
    Promise.resolve({
      snapshotText: 'habit tracker',
      marketTexts: new Map([['de', 'gewohnheiten']]),
    }),
  ),
}));

const NOW = new Date('2026-11-11T07:30:00Z');

interface DiscoveryRow {
  keywordId: string;
  source: string;
  relevance: number;
  position: number | null;
  depth: number | null;
  checkedOn: Date | null;
  keyword: { text: string; country: string };
}

const open = (
  keywordId: string,
  overrides: Partial<DiscoveryRow> = {},
): DiscoveryRow => ({
  keywordId,
  source: 'title',
  relevance: 90,
  position: null,
  depth: null,
  checkedOn: null,
  keyword: { text: keywordId, country: 'us' },
  ...overrides,
});

interface BuildOptions {
  store?: Store;
  rows?: DiscoveryRow[];
  queuedThisWeek?: number;
  readings?: Map<string, CaptureReading>;
  delistedAt?: Date | null;
  unlistedMarkets?: string[];
  autoTrackRanked?: boolean;
}

const build = (options: BuildOptions = {}) => {
  const store = options.store ?? Store.APP_STORE;
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    keywordDiscovery: {
      findMany: jest.fn().mockResolvedValue(
        Array.from({ length: options.queuedThisWeek ?? 0 }, (_, index) => ({
          keywordId: `queued-${index}`,
        })),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    app: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'app1',
        workspaceId: 'ws',
        store,
        country: 'us',
        storeAppId: '42',
        isCompetitor: false,
        delistedAt: options.delistedAt ?? null,
        unlistedMarkets: options.unlistedMarkets ?? [],
        autoTrackRanked: options.autoTrackRanked ?? false,
      }),
    },
    keywordDiscovery: {
      findMany: jest.fn().mockResolvedValue(options.rows ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    withTransaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };
  const pool = { store: jest.fn().mockResolvedValue(0) };
  const captures = {
    read: jest.fn().mockResolvedValue(options.readings ?? new Map()),
  };
  const tracker = { autoTrack: jest.fn().mockResolvedValue(undefined) };
  const appStoreQueue = { addBulk: jest.fn().mockResolvedValue([]) };
  const gplayQueue = { addBulk: jest.fn().mockResolvedValue([]) };
  const planner = new KeywordDiscoveryPlanner(
    prisma as unknown as PrismaService,
    pool as unknown as DiscoveryPoolStore,
    captures as unknown as DiscoveryCaptures,
    tracker as unknown as DiscoveryTracker,
    appStoreQueue as unknown as Queue,
    gplayQueue as unknown as Queue,
    { correlationId: 'corr' } as unknown as WorkspaceContext,
  );
  return {
    planner,
    prisma,
    tx,
    pool,
    captures,
    tracker,
    appStoreQueue,
    gplayQueue,
  };
};

const queuedIds = (queue: { addBulk: jest.Mock }): string[] => {
  const calls = queue.addBulk.mock.calls as [
    { data: { keywordId: string } }[],
  ][];
  return (calls[0]?.[0] ?? []).map(({ data }) => data.keywordId);
};

describe('KeywordDiscoveryPlanner', () => {
  it('stores the pool of every market with its listing text', async () => {
    const { planner, pool } = build();
    await planner.plan('app1', undefined, NOW);
    expect(pool.store).toHaveBeenCalledTimes(2);
    expect(pool.store).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      'us',
      'habit tracker',
      NOW,
    );
    expect(pool.store).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      'de',
      'gewohnheiten',
      NOW,
    );
  });

  it('reads only open rows of the markets the app is listed in', async () => {
    const { planner, prisma } = build({ unlistedMarkets: ['de'] });
    await planner.plan('app1', undefined, NOW);
    expect(prisma.keywordDiscovery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appId: 'app1',
          dismissedAt: null,
          keyword: {
            tracked: { none: { appId: 'app1' } },
            country: { in: ['us'] },
          },
        },
      }),
    );
  });

  it('resolves a row from a fresh capture without queueing it', async () => {
    const { planner, prisma, appStoreQueue } = build({
      rows: [open('found'), open('absent')],
      readings: new Map([
        ['found', { position: 4, depth: 50, checkedOn: '2026-11-11' }],
        ['absent', { position: null, depth: 50, checkedOn: '2026-11-11' }],
      ]),
    });
    const result = await planner.plan('app1', undefined, NOW);
    expect(result).toEqual({ queued: 1, resolved: 1 });
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        keywordId: 'found',
        position: null,
        depth: null,
        checkedOn: null,
      },
      data: expect.objectContaining({
        position: 4,
        depth: 50,
        checkedOn: new Date('2026-11-11T00:00:00Z'),
      }) as object,
    });
    expect(queuedIds(appStoreQueue)).toEqual(['absent']);
  });

  it('keeps a row a concurrent check already wrote and still queues nothing twice', async () => {
    const { planner, prisma, appStoreQueue } = build({
      rows: [open('raced')],
      readings: new Map([
        ['raced', { position: null, depth: 50, checkedOn: '2026-11-11' }],
      ]),
    });
    prisma.keywordDiscovery.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(planner.plan('app1', undefined, NOW)).resolves.toEqual({
      queued: 1,
      resolved: 0,
    });
    expect(queuedIds(appStoreQueue)).toEqual(['raced']);
  });

  it('orders the checks by the relevance a capture reading recalculated', async () => {
    const { planner, appStoreQueue } = build({
      rows: [
        open('was ranked', {
          source: 'reviews',
          relevance: 95,
          position: 3,
          depth: 200,
          checkedOn: new Date('2026-11-01T00:00:00Z'),
        }),
        open('missed today', {
          relevance: 80,
          depth: 50,
          checkedOn: new Date('2026-11-11T00:00:00Z'),
        }),
      ],
      queuedThisWeek: 39,
      readings: new Map([
        ['was ranked', { position: null, depth: 50, checkedOn: '2026-11-11' }],
      ]),
    });
    await planner.plan('app1', undefined, NOW);
    expect(queuedIds(appStoreQueue)).toEqual(['missed today']);
  });

  it('auto tracks the rows a fresh capture ranked while auto track is on', async () => {
    const reading = { position: 4, depth: 50, checkedOn: '2026-11-11' };
    const on = build({
      rows: [open('found'), open('other')],
      readings: new Map([['found', reading]]),
      autoTrackRanked: true,
    });
    await on.planner.plan('app1', undefined, NOW);
    expect(on.tracker.autoTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app1' }),
      [expect.objectContaining({ keywordId: 'found', ...reading })],
      '2026-11-11',
    );

    const off = build({
      rows: [open('found')],
      readings: new Map([['found', reading]]),
    });
    await off.planner.plan('app1', undefined, NOW);
    expect(off.tracker.autoTrack).not.toHaveBeenCalled();
  });

  it('queues nothing and spends nothing for a delisted app', async () => {
    const spend = jest.fn().mockResolvedValue(undefined);
    const { planner, pool, appStoreQueue } = build({
      rows: [open('a')],
      delistedAt: new Date('2026-11-01T00:00:00Z'),
    });
    await expect(planner.plan('app1', spend, NOW)).resolves.toEqual({
      queued: 0,
      resolved: 0,
    });
    expect(pool.store).toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
    expect(appStoreQueue.addBulk).not.toHaveBeenCalled();
  });

  it('queues nothing once the weekly cap is used', async () => {
    const spend = jest.fn().mockResolvedValue(undefined);
    const { planner, tx, appStoreQueue } = build({
      rows: [open('a')],
      queuedThisWeek: 40,
    });
    await expect(planner.plan('app1', spend, NOW)).resolves.toEqual({
      queued: 0,
      resolved: 0,
    });
    expect(tx.keywordDiscovery.findMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        queuedAt: { gte: new Date('2026-11-09T00:00:00Z') },
      },
      select: { keywordId: true },
    });
    expect(spend).not.toHaveBeenCalled();
    expect(appStoreQueue.addBulk).not.toHaveBeenCalled();
  });

  it('reserves the remaining checks under the lock before spending', async () => {
    const order: string[] = [];
    const spend = jest.fn(() => {
      order.push('spend');
      return Promise.resolve();
    });
    const { planner, tx, appStoreQueue } = build({
      rows: [open('a'), open('b'), open('c')],
      queuedThisWeek: 38,
    });
    tx.$executeRaw.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve(1);
    });
    tx.keywordDiscovery.updateMany.mockImplementation(() => {
      order.push('stamp');
      return Promise.resolve({ count: 2 });
    });
    appStoreQueue.addBulk.mockImplementation(() => {
      order.push('queue');
      return Promise.resolve([]);
    });
    await expect(planner.plan('app1', spend, NOW)).resolves.toEqual({
      queued: 2,
      resolved: 0,
    });
    expect(order).toEqual(['lock', 'stamp', 'spend', 'queue']);
    expect(tx.keywordDiscovery.updateMany).toHaveBeenCalledWith({
      where: { appId: 'app1', keywordId: { in: ['a', 'b'] } },
      data: { queuedAt: NOW },
    });
  });

  it('never reserves a row already queued this week', async () => {
    const { planner, tx, appStoreQueue } = build({
      rows: [open('queued-0'), open('b')],
      queuedThisWeek: 1,
    });
    tx.keywordDiscovery.findMany.mockResolvedValueOnce([
      { keywordId: 'queued-0' },
    ]);
    await planner.plan('app1', undefined, NOW);
    expect(queuedIds(appStoreQueue)).toEqual(['b']);
  });

  it.each([
    ['spend', 'spend'],
    ['queue', 'addBulk'],
  ])('releases the reservation when the %s fails', async (_, failing) => {
    const failure = new Error('refused');
    const spend = jest.fn().mockResolvedValue(undefined);
    const { planner, prisma, appStoreQueue } = build({ rows: [open('a')] });
    if (failing === 'spend') spend.mockRejectedValueOnce(failure);
    else appStoreQueue.addBulk.mockRejectedValueOnce(failure);
    await expect(planner.plan('app1', spend, NOW)).rejects.toBe(failure);
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledWith({
      where: { appId: 'app1', keywordId: { in: ['a'] }, queuedAt: NOW },
      data: { queuedAt: null },
    });
  });

  it('queues a prioritized job with a weekly id on the queue of the store', async () => {
    const { planner, appStoreQueue, gplayQueue } = build({
      store: Store.GOOGLE_PLAY,
      rows: [open('a')],
    });
    await planner.plan('app1', undefined, NOW);
    expect(appStoreQueue.addBulk).not.toHaveBeenCalled();
    expect(gplayQueue.addBulk).toHaveBeenCalledWith([
      {
        name: JOBS.DISCOVER_KEYWORD,
        data: {
          appId: 'app1',
          keywordId: 'a',
          workspaceId: 'ws',
          correlationId: 'corr',
        },
        opts: { priority: 1, jobId: 'discover~app1~a~2026-W46' },
      },
    ]);
  });

  it('fills the queue without a spend callback', async () => {
    const { planner, appStoreQueue } = build({ rows: [open('a')] });
    await expect(planner.plan('app1', undefined, NOW)).resolves.toEqual({
      queued: 1,
      resolved: 0,
    });
    expect(appStoreQueue.addBulk).toHaveBeenCalledTimes(1);
  });

  it('caps Google Play at its own weekly number', async () => {
    const rows = Array.from({ length: 30 }, (_, index) => open(`k${index}`));
    const { planner, gplayQueue } = build({ store: Store.GOOGLE_PLAY, rows });
    await expect(planner.plan('app1', undefined, NOW)).resolves.toEqual({
      queued: 20,
      resolved: 0,
    });
    expect(queuedIds(gplayQueue)).toHaveLength(20);
  });
});
