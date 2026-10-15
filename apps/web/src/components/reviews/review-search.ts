import type { ReviewItem } from "@asobeast/shared";
import { matchesSearch } from "@/lib/search-text";

export function matchesReviewQuery(review: ReviewItem, query: string): boolean {
  return matchesSearch(
    [
      review.title ?? "",
      review.text,
      review.userName ?? "",
      review.replyText ?? "",
      review.reply?.text ?? "",
    ],
    query,
  );
}
