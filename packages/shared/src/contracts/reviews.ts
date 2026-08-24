export interface ReviewItem {
  id: string;
  reviewId: string;
  userName: string | null;
  score: number;
  title: string | null;
  text: string;
  version: string | null;
  reviewedAt: string | null;
}

export interface ReviewList {
  reviews: ReviewItem[];
  total: number;
  versions: string[];
}

export interface RatingsPoint {
  date: string;
  ratingAvg: number | null;
  ratingCount: number | null;
}

export interface RatingsHistory {
  points: RatingsPoint[];
}

export const RATING_STARS = ['1', '2', '3', '4', '5'] as const;
export type RatingStar = (typeof RATING_STARS)[number];
export type RatingCounts = Record<RatingStar, number>;

export interface RatingsHistogram {
  available: boolean;
  counts: RatingCounts | null;
  total: number | null;
  capturedAt: string | null;
}

export interface ReviewNegativePayload {
  event: 'review.negative';
  occurredAt: string;
  app: { id: string; name: string | null };
  review: {
    score: number;
    title: string | null;
    text: string;
    version: string | null;
    reviewedAt: string | null;
  };
}
