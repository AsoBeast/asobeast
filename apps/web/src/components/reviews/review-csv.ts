import {
  replyStateOf,
  type ReviewItem,
  type ReviewList,
  type ReviewSort,
} from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { formatNumber, pluralize } from "@/lib/format";

const REVIEW_CSV_HEADERS = [
  "reviewedAt",
  "score",
  "title",
  "text",
  "version",
  "author",
  "reviewId",
  "replyState",
  "replyText",
];

export function reviewCsv(reviews: readonly ReviewItem[]): string {
  return toCsv(
    REVIEW_CSV_HEADERS,
    reviews.map((review) => [
      review.reviewedAt,
      review.score,
      review.title,
      review.text,
      review.version,
      review.userName,
      review.reviewId,
      replyStateOf(review),
      review.reply?.text || review.replyText || null,
    ]),
  );
}

export function exportReviews(
  appId: string,
  reviews: readonly ReviewItem[],
): void {
  downloadCsv(csvFilename("reviews", appId), reviewCsv(reviews));
}

export const EXPORT_ORDER: Record<ReviewSort, string> = {
  newest: "newest",
  lowest: "lowest scored",
};

export function truncatedExportNotice(
  list: Pick<ReviewList, "reviews" | "total">,
  sort: ReviewSort = "newest",
  searchHits: number | null = null,
): string | null {
  const loaded = list.reviews.length;
  if (list.total <= loaded) return null;
  const order = EXPORT_ORDER[sort];
  const counted = `${formatNumber(loaded)} of ${formatNumber(list.total)}`;
  if (searchHits === null) {
    return `Exported the ${order} ${counted} reviews. Narrow the filters to reach the others.`;
  }
  return `Exported ${pluralize(searchHits, "review")} found in the ${order} ${counted}. Narrow the filters to search the others.`;
}
