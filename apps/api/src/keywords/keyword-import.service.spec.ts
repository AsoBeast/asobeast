import { Store } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../auth/quota.service';
import { KeywordImportService } from './keyword-import.service';
import { KeywordTracker } from './keyword-tracker';

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
    app: { findFirst: jest.fn().mockResolvedValue(app) },
    trackedKeyword: { findMany: jest.fn().mockResolvedValue(tracked) },
    keyword: { createMany: jest.fn() },
  };
  const quota = {
    enforced: true,
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
    keywordIdMap: jest.fn((texts: string[], _store: string, country: string) =>
      Promise.resolve(
        new Map(texts.map((text) => [text, `${country}:${text}`])),
      ),
    ),
    claimForManual: jest.fn().mockResolvedValue({ count: 0 }),
    enqueueFirstScore: jest
      .fn<Promise<void>, [string, unknown]>()
      .mockResolvedValue(undefined),
  };
  const service = new KeywordImportService(
    prisma as unknown as PrismaService,
    tracker as unknown as KeywordTracker,
    quota as unknown as QuotaService,
  );
  return { prisma, tx, quota, tracker, service };
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
    const { prisma, service } = build([], { limit: null, used: 0 });

    const result = await service.preview('app1', {
      rows: [{ keyword: 'a1' }],
    });

    expect(result).toMatchObject({ dryRun: true, imported: 0 });
    expect(prisma.keyword.createMany).not.toHaveBeenCalled();
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

  it('writes nothing, and skips the transaction, when no row is importable', async () => {
    const { quota, tracker, service } = build(
      [trackedRow('app1', true, 'habit')],
      { limit: null, used: 0 },
    );

    const result = await service.import('app1', {
      rows: [{ keyword: 'habit' }, { keyword: '' }],
    });

    expect(result.imported).toBe(0);
    expect(quota.admitKeywordMarkets).not.toHaveBeenCalled();
    expect(tracker.enqueueFirstScore).not.toHaveBeenCalled();
  });

  it('writes only the rows that fit, groups the lookups by market and queues each first score', async () => {
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
    expect(tracker.keywordIdMap).toHaveBeenCalledTimes(2);
    expect(tx.trackedKeyword.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(
      tracker.enqueueFirstScore.mock.calls.map(([id]) => id).sort(),
    ).toEqual(['de:a2', 'pl:a1']);
  });
});
