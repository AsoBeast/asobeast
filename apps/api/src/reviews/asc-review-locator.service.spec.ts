import type { PrismaService } from '../prisma/prisma.service';
import type {
  AscCustomerReview,
  AscReviewsApi,
} from '../store-connect/asc-reviews-api';
import {
  ASC_REVIEW_LOCATE_MAX_PAGES,
  AscReviewLocator,
  AscReviewNotFoundError,
  REVIEW_NOT_IN_APP_STORE_CONNECT,
  type LocatableReview,
} from './asc-review-locator.service';

const REVIEW: LocatableReview = {
  id: 'rev-1',
  userName: 'sleepless',
  score: 1,
  title: 'Crashes on launch',
  text: 'Every time I open it the app closes.',
  reviewedAt: new Date('2026-09-05T15:12:00.000Z'),
  reply: { storeReviewId: null },
};

const MATCH: AscCustomerReview = {
  id: '00000028-b08c-0014-729e-fbd500000001',
  rating: 1,
  title: 'Crashes on launch',
  body: 'Every time I open it the app closes.',
  reviewerNickname: 'sleepless',
  createdDate: '2026-09-05T08:12:00-07:00',
  territory: 'USA',
};

const APP = { storeAppId: '123', country: 'us' };

function build(candidates: AscCustomerReview[] = [MATCH]) {
  const api = { customerReviews: jest.fn().mockResolvedValue(candidates) };
  const prisma = {
    reviewReply: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const locator = new AscReviewLocator(prisma as unknown as PrismaService);
  const locate = (review: LocatableReview = REVIEW, app = APP) =>
    locator.locate(api as unknown as AscReviewsApi, app, review);
  return { api, prisma, locate };
}

describe('AscReviewLocator', () => {
  it('answers the remembered id without a request', async () => {
    const { api, prisma, locate } = build();

    await expect(
      locate({ ...REVIEW, reply: { storeReviewId: 'asc-known' } }),
    ).resolves.toBe('asc-known');
    expect(api.customerReviews).not.toHaveBeenCalled();
    expect(prisma.reviewReply.updateMany).not.toHaveBeenCalled();
  });

  it('lists the home territory at the review rating newest first down to three days before the review, within the page cap, and remembers the match', async () => {
    const { api, prisma, locate } = build();

    await expect(locate()).resolves.toBe(MATCH.id);
    expect(api.customerReviews).toHaveBeenCalledWith('123', {
      territory: 'USA',
      rating: 1,
      until: '2026-09-02T15:12:00.000Z',
      maxPages: ASC_REVIEW_LOCATE_MAX_PAGES,
    });
    expect(ASC_REVIEW_LOCATE_MAX_PAGES).toBe(5);
    expect(prisma.reviewReply.updateMany).toHaveBeenCalledWith({
      where: { reviewId: 'rev-1' },
      data: { storeReviewId: MATCH.id },
    });
  });

  it('lists without a territory for a storefront without an alpha-3 code', async () => {
    const { api, locate } = build();

    await locate(REVIEW, { storeAppId: '123', country: 'zz' });

    expect(api.customerReviews).toHaveBeenCalledWith(
      '123',
      expect.objectContaining({ territory: null }),
    );
  });

  it('caps the pages for a review without a date', async () => {
    const { api, locate } = build();

    await locate({ ...REVIEW, reviewedAt: null });

    expect(api.customerReviews).toHaveBeenCalledWith('123', {
      territory: 'USA',
      rating: 1,
      until: null,
      maxPages: ASC_REVIEW_LOCATE_MAX_PAGES,
    });
  });

  it('answers the match when the reply row was discarded meanwhile', async () => {
    const { prisma, locate } = build();
    prisma.reviewReply.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(locate()).resolves.toBe(MATCH.id);
  });

  it('remembers nothing for a review without a reply row', async () => {
    const { prisma, locate } = build();

    await expect(locate({ ...REVIEW, reply: null })).resolves.toBe(MATCH.id);
    expect(prisma.reviewReply.updateMany).not.toHaveBeenCalled();
  });

  it('throws not found when nothing matches', async () => {
    const { prisma, locate } = build([{ ...MATCH, rating: 5 }]);

    const error: unknown = await locate().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AscReviewNotFoundError);
    expect(error).toMatchObject({ message: REVIEW_NOT_IN_APP_STORE_CONNECT });
    expect(REVIEW_NOT_IN_APP_STORE_CONNECT).toBe(
      "This review was not found in App Store Connect. Apple's feed and App Store Connect can disagree for a few days.",
    );
    expect(prisma.reviewReply.updateMany).not.toHaveBeenCalled();
  });
});
