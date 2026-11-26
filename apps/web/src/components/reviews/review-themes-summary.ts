import { REVIEW_THEMES_BASELINE, type ReviewSort } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatNumberInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

export function themesSummary(
  {
    negativeScoreMax,
    reviews,
    sort,
  }: {
    negativeScoreMax: number;
    reviews: number;
    sort: ReviewSort;
  },
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const counted = t(
    sort === "newest" ? "mentions.countedNewest" : "mentions.countedLowest",
    { count: reviews },
  );
  return t("mentions.summary", {
    stars: negativeScoreMax,
    baseline: formatNumberInLocale(REVIEW_THEMES_BASELINE, locale),
    counted,
  });
}
