import {
  replyStateOf,
  type ReviewItem,
  type ReviewList,
  type ReviewReplyCounts,
  type ReviewReplyItem,
  type ReviewReplyState,
} from "@asobeast/shared";
import type { ReviewFilters } from "./api";

export const COUNT_OF: Record<ReviewReplyState, keyof ReviewReplyCounts> = {
  needs_reply: "needsReply",
  drafted: "drafted",
  replied: "replied",
};

const countedUnder = (review: ReviewItem, filters: ReviewFilters) =>
  (filters.score === undefined || filters.score === review.score) &&
  (!filters.version || filters.version === review.version) &&
  (!filters.from || (review.reviewedAt ?? "") >= filters.from);

function moved(
  counts: ReviewReplyCounts,
  from: ReviewReplyState,
  to: ReviewReplyState,
): ReviewReplyCounts {
  if (from === to) return counts;
  return {
    ...counts,
    [COUNT_OF[from]]: Math.max(0, counts[COUNT_OF[from]] - 1),
    [COUNT_OF[to]]: counts[COUNT_OF[to]] + 1,
  };
}

export function withReviewReply(
  list: ReviewList,
  filters: ReviewFilters,
  review: ReviewItem,
  reply: ReviewReplyItem | null,
): ReviewList {
  const cached = list.reviews.find((row) => row.id === review.id) ?? review;
  if (!countedUnder(cached, filters)) return list;
  return {
    ...list,
    reviews: list.reviews.map((row) =>
      row.id === review.id ? { ...row, reply } : row,
    ),
    counts:
      list.counts &&
      moved(
        list.counts,
        replyStateOf(cached),
        replyStateOf({ ...cached, reply }),
      ),
  };
}
