import type { ReviewReplyState, ReviewSort } from "@asobeast/shared";
import type { ReviewFilters } from "@/lib/api";

export const REVIEWS_SHOW_ALL_LIMIT = 200;

export interface ReviewView {
  score: number | null;
  version: string;
  replyState: ReviewReplyState | null;
  sort: ReviewSort;
}

export function reviewFilters(
  { score, version, replyState, sort }: ReviewView,
  limit?: number,
): ReviewFilters {
  return {
    score: score ?? undefined,
    version: version || undefined,
    replyState: replyState ?? undefined,
    sort: sort === "newest" ? undefined : sort,
    limit,
  };
}

export function countsFilters(view: ReviewView): ReviewFilters {
  return reviewFilters({ ...view, replyState: null });
}
