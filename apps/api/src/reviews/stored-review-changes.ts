import { Prisma } from '@prisma/client';
import { ReviewResult } from '../store-providers/types';

export interface StoredReview {
  score: number;
  title: string | null;
  text: string;
  version: string | null;
  reviewedAt: Date | null;
  repliedAt: Date | null;
  replyText: string | null;
}

const isAfter = (next: Date | undefined, current: Date | null) =>
  next !== undefined && current !== null && next > current;

const differs = (next: Date | undefined, current: Date | null) =>
  next !== undefined && next.getTime() !== current?.getTime();

function editChanges(
  stored: StoredReview,
  fetched: ReviewResult,
): Prisma.ReviewUpdateManyMutationInput {
  if (!isAfter(fetched.updatedAt, stored.reviewedAt)) return {};
  return {
    score: fetched.score,
    title: fetched.title ?? null,
    text: fetched.text,
    version: fetched.version ?? stored.version,
    reviewedAt: fetched.updatedAt,
  };
}

function replyChanges(
  stored: StoredReview,
  fetched: ReviewResult,
): Prisma.ReviewUpdateManyMutationInput {
  return {
    ...(differs(fetched.repliedAt, stored.repliedAt)
      ? { repliedAt: fetched.repliedAt }
      : {}),
    ...(fetched.replyText && fetched.replyText !== stored.replyText
      ? { replyText: fetched.replyText }
      : {}),
  };
}

export function storedReviewChanges(
  stored: StoredReview,
  fetched: ReviewResult | undefined,
): Prisma.ReviewUpdateManyMutationInput {
  return fetched
    ? { ...editChanges(stored, fetched), ...replyChanges(stored, fetched) }
    : {};
}
