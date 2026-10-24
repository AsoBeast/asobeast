import type { Store } from '../index';
import type { AlertAppIdentity } from './changes';

export const REVIEW_REPLY_TONES = ['friendly', 'neutral', 'formal'] as const;
export type ReviewReplyTone = (typeof REVIEW_REPLY_TONES)[number];

export const REVIEW_REPLY_STATES = [
  'needs_reply',
  'drafted',
  'replied',
  'updated',
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

export const REVIEW_POST_STATES = ['pending', 'published'] as const;
export type ReviewPostState = (typeof REVIEW_POST_STATES)[number];

export interface ReviewReplyPost {
  postedAt: string;
  postedText: string;
  state: ReviewPostState;
  storeResponseId: string | null;
  postedBy: string | null;
}

export interface ReviewReplyItem {
  text: string;
  tone: ReviewReplyTone | null;
  model: string | null;
  generatedAt: string | null;
  updatedAt: string;
  repliedAt: string | null;
  post?: ReviewReplyPost | null;
}

export interface ReviewReplyCounts {
  needsReply: number;
  drafted: number;
  replied: number;
  updated: number;
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

export const REVIEW_TRANSLATION_LANGUAGE = /^[a-z]{2,3}$/;

export const UNKNOWN_LANGUAGE = 'und';

export interface ReviewTranslationRequest {
  language: string;
}

export interface ReviewTranslation {
  language: string;
  sourceLanguage: string;
  title: string | null;
  text: string;
  translatedAt: string;
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
  language?: string | null;
  translation?: ReviewTranslation | null;
}

export interface ReviewReplyPostResult {
  review: ReviewItem;
}

export interface ReviewList {
  reviews: ReviewItem[];
  total: number;
  versions: string[];
  counts?: ReviewReplyCounts;
}

export const REVIEW_THEME_KINDS = ['complaint', 'praise'] as const;
export type ReviewThemeKind = (typeof REVIEW_THEME_KINDS)[number];

export interface ReviewTheme {
  phrase: string;
  kind: ReviewThemeKind;
  mentions: number;
  negative: number;
}

export interface ReviewThemes {
  themes: ReviewTheme[];
  reviews: number;
  negativeScoreMax: number;
}

export const REVIEW_THEMES_BASELINE = 500;

const editedAfter = (
  reviewedAt: string | null | undefined,
  repliedAt: string,
): boolean =>
  typeof reviewedAt === 'string' &&
  Date.parse(reviewedAt) > Date.parse(repliedAt);

export function replyStateOf(
  review: Pick<ReviewItem, 'repliedAt' | 'reply'> &
    Partial<Pick<ReviewItem, 'reviewedAt'>>,
): ReviewReplyState {
  if (review.repliedAt) {
    return editedAfter(review.reviewedAt, review.repliedAt)
      ? 'updated'
      : 'replied';
  }
  if (review.reply?.repliedAt) return 'replied';
  if (review.reply) return 'drafted';
  return 'needs_reply';
}

export const isPostEdited = (
  reply: Pick<ReviewReplyItem, 'text' | 'post'>,
): boolean =>
  reply.post ? reply.text.trim() !== reply.post.postedText.trim() : false;

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
  app: { id: string; name: string | null } & AlertAppIdentity;
  review: {
    score: number;
    title: string | null;
    text: string;
    version: string | null;
    reviewedAt: string | null;
  };
}
