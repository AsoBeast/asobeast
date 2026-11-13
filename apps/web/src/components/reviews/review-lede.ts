import type { RatingsPoint, ReviewList } from "@asobeast/shared";
import {
  RATING_CHANGE_DAYS,
  ratedPoints,
  ratingChange,
} from "@/components/overview/rating-trend";
import { formatNumber, formatRating } from "@/lib/format";
import { dayBefore } from "@/lib/utc-day";

export interface LedePart {
  text: string;
  strong: boolean;
}

const LOW_SCORE_MAX = 2;
const CHANGE_DIGITS = 2;

const plain = (text: string): LedePart => ({ text, strong: false });
const strong = (text: string): LedePart => ({ text, strong: true });

function arrivals(list: ReviewList, today: string): LedePart[] {
  const since = dayBefore(today, 1);
  const fresh = list.reviews.filter(
    (review) =>
      review.reviewedAt !== null && review.reviewedAt.slice(0, 10) >= since,
  );
  if (fresh.length === 0) return [plain("No new reviews since yesterday.")];
  const capped =
    fresh.length === list.reviews.length && list.total > fresh.length;
  const count = `${formatNumber(fresh.length)}${capped ? " or more" : ""}`;
  const noun = fresh.length === 1 && !capped ? "review" : "reviews";
  const low = fresh.filter((review) => review.score <= LOW_SCORE_MAX).length;
  const lowNote = low > 0 ? `, ${formatNumber(low)} at two stars or less` : "";
  return [strong(`${count} new ${noun}`), plain(` since yesterday${lowNote}.`)];
}

function queue(list: ReviewList): LedePart[] {
  if (!list.counts) return [];
  const waiting = list.counts.needsReply;
  if (waiting === 0) return [plain("Nothing needs a reply.")];
  return [
    strong(
      waiting === 1
        ? "1 needs a reply."
        : `${formatNumber(waiting)} need a reply.`,
    ),
  ];
}

function ratingMove(points: readonly RatingsPoint[]): LedePart[] {
  const latest = ratedPoints(points).at(-1);
  if (!latest) return [];
  const rating = `Rating ${formatRating(latest.ratingAvg)}`;
  const change = ratingChange(points, RATING_CHANGE_DAYS);
  if (change === null) return [plain(`${rating}.`)];
  const size = Math.abs(change).toFixed(CHANGE_DIGITS);
  if (Number(size) === 0) {
    return [plain(`${rating}, unchanged over ${RATING_CHANGE_DAYS} days.`)];
  }
  return [
    plain(
      `${rating}, ${change > 0 ? "up" : "down"} ${size} over ${RATING_CHANGE_DAYS} days.`,
    ),
  ];
}

export function reviewsLede({
  list,
  points,
  today,
}: {
  list: ReviewList;
  points: readonly RatingsPoint[];
  today: string;
}): LedePart[] {
  const rating = ratingMove(points);
  if (list.total === 0 && rating.length === 0) {
    return [
      plain(
        "No reviews or ratings are stored yet. They are read on the daily run.",
      ),
    ];
  }
  const sentences =
    list.total === 0
      ? [[plain("No reviews are stored yet.")], rating]
      : [arrivals(list, today), queue(list), rating];
  return sentences
    .filter((sentence) => sentence.length > 0)
    .flatMap((sentence, index) =>
      index === 0
        ? sentence
        : [
            { ...sentence[0], text: ` ${sentence[0].text}` },
            ...sentence.slice(1),
          ],
    );
}
