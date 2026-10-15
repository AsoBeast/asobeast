import {
  QUERY_BOUNDS,
  type ReviewReplyState,
  type ReviewSort,
} from "@asobeast/shared";
import type { ReviewFilters, ReviewThemeFilters } from "@/lib/api";
import { presetToRange, type RatingsRange } from "@/lib/ranges";

export const REVIEWS_SHOW_ALL_LIMIT = QUERY_BOUNDS.reviewsLimit.max;

export interface ReviewView {
  score: number | null;
  version: string;
  since: RatingsRange | null;
  replyState: ReviewReplyState | null;
  sort: ReviewSort;
}

export function reviewFilters(
  { score, version, since, replyState, sort }: ReviewView,
  limit?: number,
): ReviewFilters {
  return {
    score: score ?? undefined,
    version: version || undefined,
    from: since ? presetToRange(since).from : undefined,
    replyState: replyState ?? undefined,
    sort: sort === "newest" ? undefined : sort,
    limit,
  };
}

export function narrowsReviews({ score, version, since }: ReviewView): boolean {
  return score !== null || version !== "" || since !== null;
}

export function themesFilters(view: ReviewView): ReviewThemeFilters {
  const { score, version, from, replyState } = reviewFilters(view);
  return { score, version, from, replyState };
}

export function countsFilters(view: ReviewView): ReviewFilters {
  return reviewFilters({ ...view, replyState: null, sort: "newest" });
}
