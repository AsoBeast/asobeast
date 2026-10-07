import { Store } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { KeywordTracker } from './keyword-tracker';

const buildTracker = (stored: { id: string; text: string }[]) => {
  const prisma = {
    keyword: {
      createMany: jest.fn().mockResolvedValue({ count: stored.length }),
      findMany: jest.fn().mockResolvedValue(stored),
    },
  };
  const queue = { add: jest.fn() } as unknown as Queue;
  const tracker = new KeywordTracker(
    prisma as unknown as PrismaService,
    queue,
    queue,
    new WorkspaceContext(),
  );
  return { prisma, tracker };
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
});
