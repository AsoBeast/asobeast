import type { ReviewItem } from "@asobeast/shared";
import { formatDate } from "@/lib/format";

type ReviewSubjectFields = Pick<
  ReviewItem,
  "score" | "userName" | "reviewedAt"
>;

export function reviewSubject(review: ReviewSubjectFields): string {
  const author = review.userName ?? "Anonymous";
  const day = review.reviewedAt ? ` on ${formatDate(review.reviewedAt)}` : "";
  return `${review.score} star review by ${author}${day}`;
}

export function reviewActionLabel(
  action: string,
  review: ReviewSubjectFields,
): string {
  return `${action} the ${reviewSubject(review)}`;
}
