import { PrismaClient } from '@prisma/client';
import { testDb } from '../helpers/test-db';

describe('Review replies against an upgraded baseline database', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reads every baseline review as never checked for a reply', async () => {
    const reviews = await prisma.review.findMany({
      select: { repliedAt: true, replyCheckedAt: true },
    });

    expect(reviews.length).toBeGreaterThan(0);
    expect(
      reviews.every(
        (review) => review.repliedAt === null && review.replyCheckedAt === null,
      ),
    ).toBe(true);
  });
});
