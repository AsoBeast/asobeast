import type { ReviewItem } from "@asobeast/shared";
import { formatDate } from "@/lib/format";

type ReviewSubjectFields = Pick<
  ReviewItem,
  "score" | "userName" | "reviewedAt"
>;

export interface ReviewTwin {
  rank: number;
  of: number;
}

export function reviewSubject(
  review: ReviewSubjectFields,
  twin?: ReviewTwin,
): string {
  const author = review.userName ?? "Anonymous";
  const day = review.reviewedAt ? ` on ${formatDate(review.reviewedAt)}` : "";
  const place = twin ? ` (${twin.rank} of ${twin.of})` : "";
  return `${review.score} star review by ${author}${day}${place}`;
}

export function reviewActionLabel(
  action: string,
  review: ReviewSubjectFields,
  twin?: ReviewTwin,
): string {
  return `${action} the ${reviewSubject(review, twin)}`;
}

export function reviewTwins(
  reviews: readonly (ReviewSubjectFields & Pick<ReviewItem, "id">)[],
): Map<string, ReviewTwin> {
  const idsBySubject = new Map<string, string[]>();
  for (const review of reviews) {
    const subject = reviewSubject(review);
    const ids = idsBySubject.get(subject);
    if (ids) ids.push(review.id);
    else idsBySubject.set(subject, [review.id]);
  }
  const twins = new Map<string, ReviewTwin>();
  for (const ids of idsBySubject.values()) {
    if (ids.length < 2) continue;
    ids.forEach((id, index) =>
      twins.set(id, { rank: index + 1, of: ids.length }),
    );
  }
  return twins;
}
