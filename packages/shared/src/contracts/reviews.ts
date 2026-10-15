import type { Store } from '../index';

export const REVIEW_REPLY_TONES = ['friendly', 'neutral', 'formal'] as const;
export type ReviewReplyTone = (typeof REVIEW_REPLY_TONES)[number];

export const REVIEW_REPLY_STATES = [
  'needs_reply',
  'drafted',
  'replied',
] as const;
export type ReviewReplyState = (typeof REVIEW_REPLY_STATES)[number];

export const REVIEW_SORTS = ['newest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEW_REPLY_LIMITS: Record<Store, number> = {
  APP_STORE: 2000,
  GOOGLE_PLAY: 350,
};
export const REVIEW_REPLY_MAX_CHARS = Math.max(
  ...Object.values(REVIEW_REPLY_LIMITS),
);
export const REVIEW_REPLY_INSTRUCTIONS_MAX = 500;
export const REVIEW_REPLY_GUIDELINES_MAX = 1000;

export interface ReviewReplyItem {
  text: string;
  tone: ReviewReplyTone | null;
  model: string | null;
  generatedAt: string | null;
  updatedAt: string;
  repliedAt: string | null;
}

export interface ReviewReplyCounts {
  needsReply: number;
  drafted: number;
  replied: number;
}

export interface ReviewReplyDraftRequest {
  tone?: ReviewReplyTone;
  instructions?: string;
}

export interface ReviewReplyDraftResult {
  reply: ReviewReplyItem;
  language: string;
  truncated: boolean;
}

export interface ReviewReplyPatchRequest {
  text?: string;
  replied?: boolean;
}

export interface ReviewReplyGuidelines {
  guidelines: string;
}

export interface ReviewItem {
  id: string;
  reviewId: string;
  userName: string | null;
  score: number;
  title: string | null;
  text: string;
  version: string | null;
  reviewedAt: string | null;
  repliedAt?: string | null;
  replyText?: string | null;
  reply?: ReviewReplyItem | null;
}

export interface ReviewList {
  reviews: ReviewItem[];
  total: number;
  versions: string[];
  counts?: ReviewReplyCounts;
}

export interface ReviewTheme {
  phrase: string;
  mentions: number;
  negative: number;
}

export interface ReviewThemes {
  themes: ReviewTheme[];
  reviews: number;
  negativeScoreMax: number;
}

export function replyStateOf(
  review: Pick<ReviewItem, 'repliedAt' | 'reply'>,
): ReviewReplyState {
  if (review.repliedAt || review.reply?.repliedAt) return 'replied';
  if (review.reply) return 'drafted';
  return 'needs_reply';
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
