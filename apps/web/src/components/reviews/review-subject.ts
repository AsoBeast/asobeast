import type { ReviewItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDateInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

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
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const author = review.userName ?? t("subject.anonymous");
  const day = review.reviewedAt
    ? t("subject.on", { date: formatDateInLocale(review.reviewedAt, locale) })
    : "";
  const place = twin
    ? t("subject.place", { rank: twin.rank, of: twin.of })
    : "";
  return t("subject.review", {
    score: review.score,
    author,
    day,
    place,
  });
}

export function reviewActionLabel(
  action: string,
  review: ReviewSubjectFields,
  twin?: ReviewTwin,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return t("subject.action", {
    action,
    subject: reviewSubject(review, twin, t, locale),
  });
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
