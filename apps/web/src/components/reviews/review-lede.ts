import type { RatingsPoint, ReviewList } from "@asobeast/shared";
import {
  RATING_CHANGE_DAYS,
  ratedPoints,
  ratingChange,
} from "@/components/overview/rating-trend";
import { createTranslator } from "next-intl";
import enReviews from "../../../messages/en/reviews.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatNumberInLocale, formatRating } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { dayBefore } from "@/lib/utc-day";

export interface LedePart {
  text: string;
  strong: boolean;
}

const english = createTranslator({
  locale: "en",
  namespace: "reviews",
  messages: { reviews: enReviews },
});

const LOW_SCORE_MAX = 2;
const CHANGE_DIGITS = 2;

const plain = (text: string): LedePart => ({ text, strong: false });
const strong = (text: string): LedePart => ({ text, strong: true });

function arrivals(
  list: ReviewList,
  today: string,
  t: MessageTranslator,
  locale: Locale,
): LedePart[] {
  const since = dayBefore(today, 1);
  const fresh = list.reviews.filter(
    (review) =>
      review.reviewedAt !== null && review.reviewedAt.slice(0, 10) >= since,
  );
  if (fresh.length === 0) return [plain(t("lede.noNew"))];
  const capped =
    fresh.length === list.reviews.length && list.total > fresh.length;
  const low = fresh.filter((review) => review.score <= LOW_SCORE_MAX).length;
  const lowNote =
    low > 0
      ? t("lede.lowNote", { count: formatNumberInLocale(low, locale) })
      : "";
  return [
    strong(
      capped
        ? t("lede.newCapped", { count: fresh.length })
        : t("lede.newCount", { count: fresh.length }),
    ),
    plain(`${t("lede.sinceYesterday")}${lowNote}.`),
  ];
}

function queue(list: ReviewList, t: MessageTranslator): LedePart[] {
  if (!list.counts) return [];
  const waiting = list.counts.needsReply;
  if (waiting === 0) return [plain(t("lede.nothingToReply"))];
  return [
    strong(
      waiting === 1
        ? t("lede.oneNeedsReply")
        : t("lede.manyNeedReply", { count: waiting }),
    ),
  ];
}

function ratingMove(
  points: readonly RatingsPoint[],
  t: MessageTranslator,
): LedePart[] {
  const latest = ratedPoints(points).at(-1);
  if (!latest) return [];
  const rating = t("lede.rating", { rating: formatRating(latest.ratingAvg) });
  const change = ratingChange(points, RATING_CHANGE_DAYS);
  if (change === null) return [plain(`${rating}.`)];
  const size = Math.abs(change).toFixed(CHANGE_DIGITS);
  if (Number(size) === 0) {
    return [
      plain(t("lede.ratingUnchanged", { rating, days: RATING_CHANGE_DAYS })),
    ];
  }
  return [
    plain(
      t("lede.ratingMove", {
        rating,
        direction: t(change > 0 ? "lede.up" : "lede.down"),
        size,
        days: RATING_CHANGE_DAYS,
      }),
    ),
  ];
}

export function reviewsLede(
  {
    list,
    points,
    today,
  }: {
    list: ReviewList;
    points: readonly RatingsPoint[];
    today: string;
  },
  t: MessageTranslator = english,
  locale: Locale = "en",
): LedePart[] {
  const rating = ratingMove(points, t);
  const rated = points.some(
    (point) => point.ratingAvg !== null || point.ratingCount !== null,
  );
  if (list.total === 0 && !rated) {
    return [plain(t("lede.noStored"))];
  }
  const sentences =
    list.total === 0
      ? [[plain(t("lede.noReviews"))], rating]
      : [arrivals(list, today, t, locale), queue(list, t), rating];
  return sentences
    .filter((sentence) => sentence.length > 0)
    .flatMap((sentence, index) =>
      index === 0
        ? sentence
        : [
            {
              ...sentence[0],
              text: `${locale === "en" ? " " : ""}${sentence[0].text}`,
            },
            ...sentence.slice(1),
          ],
    );
}
