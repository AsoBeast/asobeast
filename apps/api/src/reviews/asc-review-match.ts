import type { AscCustomerReview } from '../store-connect/asc-reviews-api';

export interface StoredReview {
  userName: string | null;
  score: number;
  title: string | null;
  text: string;
  reviewedAt: Date | null;
}

interface Ranked {
  candidate: AscCustomerReview;
  nickname: number;
  distance: number;
}

const trimmed = (value: string | null): string | null => {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
};

const sameContent = (
  review: StoredReview,
  candidate: AscCustomerReview,
): boolean =>
  candidate.rating === review.score &&
  trimmed(candidate.body) === trimmed(review.text) &&
  trimmed(candidate.title) === trimmed(review.title);

function nicknameRank(
  review: StoredReview,
  candidate: AscCustomerReview,
): number | null {
  const wanted = trimmed(review.userName);
  const nickname = trimmed(candidate.reviewerNickname);
  if (wanted !== null) return nickname === wanted ? 0 : null;
  return nickname === null ? 0 : 1;
}

function distanceFrom(
  review: StoredReview,
  candidate: AscCustomerReview,
): number {
  if (review.reviewedAt === null) return 0;
  const created = Date.parse(candidate.createdDate);
  return Number.isNaN(created)
    ? Number.POSITIVE_INFINITY
    : Math.abs(created - review.reviewedAt.getTime());
}

const byDistance = (a: number, b: number): number => (a === b ? 0 : a - b);

export function matchCustomerReview(
  review: StoredReview,
  candidates: AscCustomerReview[],
): AscCustomerReview | null {
  const ranked = candidates.flatMap((candidate): Ranked[] => {
    const nickname = sameContent(review, candidate)
      ? nicknameRank(review, candidate)
      : null;
    return nickname === null
      ? []
      : [{ candidate, nickname, distance: distanceFrom(review, candidate) }];
  });
  const order = (a: Ranked, b: Ranked): number =>
    a.nickname - b.nickname || byDistance(a.distance, b.distance);
  ranked.sort(order);
  const [best, next] = ranked;
  if (!best) return null;
  const tied =
    next !== undefined &&
    next.candidate.id !== best.candidate.id &&
    order(best, next) === 0;
  return tied ? null : best.candidate;
}
