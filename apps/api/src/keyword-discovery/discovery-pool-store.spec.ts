import { Store } from '@prisma/client';
import { KeywordTracker } from '../keywords/keyword-tracker';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryCandidates } from './discovery-candidates.service';
import { PoolCandidate } from './discovery-pool';
import { DiscoveryPoolStore } from './discovery-pool-store';

const app = {
  id: 'app1',
  workspaceId: 'ws',
  store: Store.APP_STORE,
  country: 'us',
  storeAppId: '1',
};

const NOW = new Date('2026-11-09T07:30:00Z');

const candidate = (
  text: string,
  overrides: Partial<PoolCandidate> = {},
): PoolCandidate => ({
  text,
  source: 'title',
  relevance: 90,
  traffic: null,
  ...overrides,
});

interface StoredDiscovery {
  keywordId: string;
  source: string;
  relevance: number;
  position: number | null;
  checkedOn: Date | null;
}

const build = (
  found: PoolCandidate[],
  options: {
    tracked?: string[];
    dismissed?: string[];
    stored?: StoredDiscovery[];
  } = {},
) => {
  const prisma = {
    trackedKeyword: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (options.tracked ?? []).map((text) => ({ keyword: { text } })),
        ),
    },
    keywordDiscovery: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(
          (options.dismissed ?? []).map((text) => ({ keyword: { text } })),
        )
        .mockResolvedValueOnce(options.stored ?? []),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const candidates = {
    forMarket: jest.fn().mockResolvedValue(found),
  };
  const tracker = {
    keywordIdMap: jest.fn((texts: string[]) =>
      Promise.resolve(new Map(texts.map((text) => [text, `id:${text}`]))),
    ),
  };
  const store = new DiscoveryPoolStore(
    prisma as unknown as PrismaService,
    candidates as unknown as DiscoveryCandidates,
    tracker as unknown as KeywordTracker,
  );
  return { store, prisma, candidates, tracker };
};

describe('DiscoveryPoolStore', () => {
  it('creates the new rows and stamps every proposed row as seen', async () => {
    const { store, prisma, tracker } = build([
      candidate('habit tracker'),
      candidate('daily goals', { source: 'reviews', relevance: 60 }),
    ]);
    await expect(store.store(app, 'us', 'habit tracker', NOW)).resolves.toBe(2);
    expect(tracker.keywordIdMap).toHaveBeenCalledTimes(1);
    expect(tracker.keywordIdMap).toHaveBeenCalledWith(
      ['habit tracker', 'daily goals'],
      Store.APP_STORE,
      'us',
    );
    expect(prisma.keywordDiscovery.createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: 'app1',
          workspaceId: 'ws',
          keywordId: 'id:habit tracker',
          source: 'title',
          relevance: 90,
          seenAt: NOW,
        },
        {
          appId: 'app1',
          workspaceId: 'ws',
          keywordId: 'id:daily goals',
          source: 'reviews',
          relevance: 60,
          seenAt: NOW,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledWith({
      where: {
        appId: 'app1',
        keywordId: { in: ['id:habit tracker', 'id:daily goals'] },
      },
      data: { seenAt: NOW },
    });
  });

  it('leaves out the phrases the app tracks or dismissed', async () => {
    const { store, tracker } = build(
      [candidate('habit tracker'), candidate('goals'), candidate('streaks')],
      { tracked: ['habit tracker'], dismissed: ['goals'] },
    );
    await store.store(app, 'us', '', NOW);
    expect(tracker.keywordIdMap).toHaveBeenCalledWith(
      ['streaks'],
      Store.APP_STORE,
      'us',
    );
  });

  it('updates a stored row whose source or relevance changed and keeps the rest', async () => {
    const { store, prisma } = build(
      [
        candidate('habit tracker'),
        candidate('streaks', { source: 'subtitle' }),
      ],
      {
        stored: [
          {
            keywordId: 'id:habit tracker',
            source: 'title',
            relevance: 90,
            position: null,
            checkedOn: null,
          },
          {
            keywordId: 'id:streaks',
            source: 'reviews',
            relevance: 60,
            position: null,
            checkedOn: null,
          },
        ],
      },
    );
    await store.store(app, 'us', '', NOW);
    expect(prisma.keywordDiscovery.createMany).not.toHaveBeenCalled();
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledWith({
      where: { appId: 'app1', keywordId: 'id:streaks', checkedOn: null },
      data: { source: 'subtitle', relevance: 90 },
    });
  });

  it('keeps the ranking evidence of a checked row in its relevance', async () => {
    const { store, prisma } = build(
      [candidate('meditation timer', { source: 'reviews', relevance: 60 })],
      {
        stored: [
          {
            keywordId: 'id:meditation timer',
            source: 'reviews',
            relevance: 70,
            position: 12,
            checkedOn: new Date('2026-11-08T00:00:00Z'),
          },
        ],
      },
    );
    await store.store(app, 'us', '', NOW);
    expect(prisma.keywordDiscovery.updateMany).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for an empty pool', async () => {
    const { store, prisma, tracker } = build([]);
    await expect(store.store(app, 'us', '', NOW)).resolves.toBe(0);
    expect(tracker.keywordIdMap).not.toHaveBeenCalled();
    expect(prisma.keywordDiscovery.updateMany).not.toHaveBeenCalled();
  });
});
