import type { Prisma } from '@prisma/client';
import type { ReviewResult } from '../store-providers/types';

export function newReviewRow(
  appId: string,
  review: ReviewResult,
  replyCheckedAt: Date | null,
): Prisma.ReviewCreateManyInput {
  const tracksReplies = replyCheckedAt !== null;
  return {
    appId,
    reviewId: review.reviewId,
    userName: review.userName ?? null,
    score: review.score,
    title: review.title ?? null,
    text: review.text,
    version: review.version ?? null,
    reviewedAt: review.updatedAt ?? null,
    repliedAt: tracksReplies ? (review.repliedAt ?? null) : null,
    replyText: tracksReplies ? (review.replyText ?? null) : null,
    replyCheckedAt,
  };
}
