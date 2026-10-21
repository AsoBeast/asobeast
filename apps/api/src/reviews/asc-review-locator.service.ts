import { Injectable } from '@nestjs/common';
import { appStoreTerritoryOf } from '@asobeast/shared';
import { addDays } from '../analytics/analytics.support';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AscReviewsApi,
  ReviewListQuery,
} from '../store-connect/asc-reviews-api';
import { matchCustomerReview, type StoredReview } from './asc-review-match';

export const ASC_REVIEW_LOOKBACK_DAYS = 3;
export const ASC_REVIEW_LOCATE_MAX_PAGES = 5;
export const REVIEW_NOT_IN_APP_STORE_CONNECT =
  "This review was not found in App Store Connect. Apple's feed and App Store Connect can disagree for a few days.";

export class AscReviewNotFoundError extends Error {
  constructor() {
    super(REVIEW_NOT_IN_APP_STORE_CONNECT);
    this.name = 'AscReviewNotFoundError';
  }
}

export interface LocatableReview extends StoredReview {
  id: string;
  reply: { storeReviewId: string | null } | null;
}

export interface LocatableApp {
  storeAppId: string;
  country: string;
}

const listQuery = (
  country: string,
  { score, reviewedAt }: StoredReview,
): ReviewListQuery => ({
  territory: appStoreTerritoryOf(country),
  rating: score,
  until:
    reviewedAt === null
      ? null
      : addDays(reviewedAt, -ASC_REVIEW_LOOKBACK_DAYS).toISOString(),
  maxPages: ASC_REVIEW_LOCATE_MAX_PAGES,
});

@Injectable()
export class AscReviewLocator {
  constructor(private readonly prisma: PrismaService) {}

  async locate(
    api: AscReviewsApi,
    app: LocatableApp,
    review: LocatableReview,
  ): Promise<string> {
    const remembered = review.reply?.storeReviewId;
    if (remembered) return remembered;
    const candidates = await api.customerReviews(
      app.storeAppId,
      listQuery(app.country, review),
    );
    const match = matchCustomerReview(review, candidates);
    if (!match) throw new AscReviewNotFoundError();
    if (review.reply) {
      await this.prisma.reviewReply.updateMany({
        where: { reviewId: review.id },
        data: { storeReviewId: match.id },
      });
    }
    return match.id;
  }
}
