import type { ReviewItem, ReviewList } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";

const REVIEW_CSV_HEADERS = [
  "reviewedAt",
  "score",
  "title",
  "text",
  "version",
  "author",
  "reviewId",
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
    ]),
  );
}

export function exportReviews(
  appId: string,
  reviews: readonly ReviewItem[],
): void {
  downloadCsv(csvFilename("reviews", appId), reviewCsv(reviews));
}

export function truncatedExportNotice(
  list: Pick<ReviewList, "reviews" | "total">,
): string | null {
  const exported = list.reviews.length;
  if (list.total <= exported) return null;
  return `Exported the newest ${formatNumber(exported)} of ${formatNumber(list.total)} reviews. Narrow the filters to reach the others.`;
}
