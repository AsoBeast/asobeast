import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { JOBS, isoWeekKey, scoreJobId } from '../jobs/jobs.types';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordTracker } from './keyword-tracker';

const buildTracker = (
  stored: { id: string; text: string; country?: string }[],
  scored: string[] = [],
) => {
  const prisma = {
    keyword: {
      createMany: jest.fn().mockResolvedValue({ count: stored.length }),
      findMany: jest.fn().mockResolvedValue(stored),
    },
    keywordMetric: {
      findMany: jest
        .fn()
        .mockResolvedValue(scored.map((keywordId) => ({ keywordId }))),
    },
  };
  const appStoreQueue = { add: jest.fn(), addBulk: jest.fn() };
  const gplayQueue = { add: jest.fn(), addBulk: jest.fn() };
  const tracker = new KeywordTracker(
    prisma as unknown as PrismaService,
    appStoreQueue as unknown as Queue,
    gplayQueue as unknown as Queue,
    new WorkspaceContext(),
  );
  return { prisma, tracker, appStoreQueue, gplayQueue };
};

describe('KeywordTracker', () => {
  it('maps every stored phrase to its keyword id and skips a phrase that was not stored', async () => {
    const { prisma, tracker } = buildTracker([
      { id: 'k2', text: 'streak counter' },
    ]);

    const ids = await tracker.keywordIdMap(
      ['streak counter', 'habit tracker'],
      Store.APP_STORE,
      'pl',
    );

    expect([...ids]).toEqual([['streak counter', 'k2']]);
    expect(prisma.keyword.createMany).toHaveBeenCalledWith({
      data: [
        { text: 'habit tracker', store: Store.APP_STORE, country: 'pl' },
        { text: 'streak counter', store: Store.APP_STORE, country: 'pl' },
      ],
      skipDuplicates: true,
    });
  });

  it('lists the ids in the order the phrases were given', async () => {
    const { tracker } = buildTracker([
      { id: 'k1', text: 'habit tracker' },
      { id: 'k2', text: 'streak counter' },
    ]);

    await expect(
      tracker.keywordIdsFor(
        ['streak counter', 'habit tracker'],
        Store.APP_STORE,
        'us',
      ),
    ).resolves.toEqual(['k2', 'k1']);
  });

  it('stores and reads the keywords of every market in one write and one read', async () => {
    const { prisma, tracker } = buildTracker([
      { id: 'k1', text: 'habit', country: 'us' },
      { id: 'k2', text: 'habit', country: 'pl' },
      { id: 'k3', text: 'focus', country: 'pl' },
    ]);

    const ids = await tracker.keywordIdsAcrossMarkets(
      [
        { text: 'habit', country: 'us' },
        { text: 'focus', country: 'pl' },
        { text: 'habit', country: 'pl' },
      ],
      Store.APP_STORE,
    );

    expect(prisma.keyword.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.keyword.createMany).toHaveBeenCalledWith({
      data: [
        { text: 'focus', store: Store.APP_STORE, country: 'pl' },
        { text: 'habit', store: Store.APP_STORE, country: 'pl' },
        { text: 'habit', store: Store.APP_STORE, country: 'us' },
      ],
      skipDuplicates: true,
    });
    expect(prisma.keyword.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.keyword.findMany).toHaveBeenCalledWith({
      where: {
        store: Store.APP_STORE,
        OR: [
          { country: 'us', text: { in: ['habit'] } },
          { country: 'pl', text: { in: ['focus', 'habit'] } },
        ],
      },
      select: { id: true, text: true, country: true },
    });
    expect([...ids]).toEqual([
      ['us~habit', 'k1'],
      ['pl~habit', 'k2'],
      ['pl~focus', 'k3'],
    ]);
  });

  it('queues the first score of every unscored keyword in one bulk add with the per keyword job id', async () => {
    const { prisma, tracker, appStoreQueue, gplayQueue } = buildTracker(
      [],
      ['k2'],
    );

    await tracker.enqueueFirstScores(['k1', 'k2', 'k3'], {
      store: Store.APP_STORE,
      workspaceId: 'ws',
    });

    expect(prisma.keywordMetric.findMany).toHaveBeenCalledWith({
      where: { keywordId: { in: ['k1', 'k2', 'k3'] } },
      select: { keywordId: true },
      distinct: ['keywordId'],
    });
    const week = isoWeekKey();
    expect(appStoreQueue.addBulk).toHaveBeenCalledWith(
      ['k1', 'k3'].map((keywordId) => ({
        name: JOBS.SCORE_KEYWORD,
        data: { keywordId, workspaceId: 'ws', correlationId: undefined },
        opts: { jobId: scoreJobId(keywordId, week) },
      })),
    );
    expect(appStoreQueue.add).not.toHaveBeenCalled();
    expect(gplayQueue.addBulk).not.toHaveBeenCalled();
  });

  it('queues nothing and reads nothing for no keywords, and adds nothing when all are scored', async () => {
    const empty = buildTracker([]);
    await empty.tracker.enqueueFirstScores([], {
      store: Store.GOOGLE_PLAY,
      workspaceId: 'ws',
    });
    expect(empty.prisma.keywordMetric.findMany).not.toHaveBeenCalled();

    const scored = buildTracker([], ['k1']);
    await scored.tracker.enqueueFirstScores(['k1'], {
      store: Store.GOOGLE_PLAY,
      workspaceId: 'ws',
    });
    expect(scored.gplayQueue.addBulk).not.toHaveBeenCalled();
  });
});
