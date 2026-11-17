import type { PrismaService } from '../prisma/prisma.service';
import type { ReviewResult } from '../store-providers/types';
import { ReviewInserts } from './review-inserts';

const review = (reviewId: string): ReviewResult => ({
  reviewId,
  score: 1,
  text: `review ${reviewId}`,
  updatedAt: new Date('2026-11-16T09:00:00.000Z'),
});

const build = (written: string[]) => {
  const createManyAndReturn = jest
    .fn()
    .mockResolvedValue(written.map((reviewId) => ({ reviewId })));
  const inserts = new ReviewInserts({
    review: { createManyAndReturn },
  } as unknown as PrismaService);
  return { inserts, createManyAndReturn };
};

describe('ReviewInserts.store', () => {
  it('inserts the absent reviews and returns only those the database wrote', async () => {
    const absent = [review('a'), review('b'), review('c')];
    const { inserts, createManyAndReturn } = build(['a', 'c']);

    const stored = await inserts.store({
      appId: 'app1',
      absent,
      checkedAt: null,
    });

    expect(stored).toEqual([absent[0], absent[2]]);
    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        select: { reviewId: true },
      }),
    );
  });

  it('writes no statement when nothing is absent', async () => {
    const { inserts, createManyAndReturn } = build([]);

    await expect(
      inserts.store({ appId: 'app1', absent: [], checkedAt: null }),
    ).resolves.toEqual([]);
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it('stores the reply check time it was given', async () => {
    const checkedAt = new Date('2026-11-17T03:00:00.000Z');
    const { inserts, createManyAndReturn } = build(['a']);

    await inserts.store({ appId: 'app1', absent: [review('a')], checkedAt });

    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ appId: 'app1', replyCheckedAt: checkedAt }),
        ],
      }),
    );
  });

  it('rejects when the insert fails', async () => {
    const { inserts, createManyAndReturn } = build([]);
    createManyAndReturn.mockRejectedValue(new Error('insert refused'));

    await expect(
      inserts.store({ appId: 'app1', absent: [review('a')], checkedAt: null }),
    ).rejects.toThrow('insert refused');
  });
});
