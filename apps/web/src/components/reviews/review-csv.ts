import {
  replyStateOf,
  type ReviewItem,
  type ReviewList,
  type ReviewSort,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { formatNumberInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

export function reviewCsv(
  reviews: readonly ReviewItem[],
  t: MessageTranslator = english,
): string {
  return toCsv(
    [
      t("csv.reviewedAt"),
      t("csv.score"),
      t("csv.title"),
      t("csv.text"),
      t("csv.version"),
      t("csv.author"),
      t("csv.reviewId"),
      t("csv.replyState"),
      t("csv.replyText"),
    ],
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
  t: MessageTranslator = english,
): void {
  downloadCsv(csvFilename("reviews", appId), reviewCsv(reviews, t));
}

export const EXPORT_ORDER: Record<ReviewSort, string> = {
  newest: "newest",
  lowest: "lowest scored",
};

export function truncatedExportNotice(
  list: Pick<ReviewList, "reviews" | "total">,
  sort: ReviewSort = "newest",
  searchHits: number | null = null,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string | null {
  const loaded = list.reviews.length;
  if (list.total <= loaded) return null;
  const order = EXPORT_ORDER[sort];
  const counted = `${formatNumberInLocale(loaded, locale)} of ${formatNumberInLocale(list.total, locale)}`;
  if (searchHits === null) {
    return t("exportNotice", { order, counted });
  }
  return t("exportSearchNotice", {
    count: searchHits,
    order,
    counted,
  });
}
