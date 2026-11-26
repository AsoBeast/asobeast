import type { RatingsHistory } from "@asobeast/shared";
import {
  GROWING_RATINGS_HISTORY,
  grownRatingsPoints,
  utcDaysAgo,
} from "./fixtures.mts";

export const RATINGS_HISTORY_COOKIE = "e2e_ratings";

export const HISTOGRAM_FAILING_COOKIE = "e2e_histogram_failing";

const SHORT_RATINGS_HISTORY: RatingsHistory = {
  points: [
    { date: utcDaysAgo(1), ratingAvg: 4.4, ratingCount: 180 },
    { date: utcDaysAgo(0), ratingAvg: 4.4, ratingCount: 184 },
  ],
};

const DROPPING_RATINGS_HISTORY: RatingsHistory = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: utcDaysAgo(29 - index),
    ratingAvg: index < 22 ? 4.6 : 4.6 - (index - 21) * 0.05,
    ratingCount: 5000 + index * 12 + (index > 21 ? (index - 21) * 40 : 0),
  })),
};

const SINGLE_RATINGS_HISTORY: RatingsHistory = {
  points: [{ date: utcDaysAgo(0), ratingAvg: 4.4, ratingCount: 184 }],
};

const THIN_RATINGS_HISTORY: RatingsHistory = {
  points: grownRatingsPoints(
    { daysAgo: 30, count: 500, average: 4.3 },
    Array.from({ length: 30 }, (_, day) => (day % 10 === 9 ? 1 : 0)),
    4.7,
  ),
};

const RESET_RATINGS_HISTORY: RatingsHistory = {
  points: [
    ...grownRatingsPoints(
      { daysAgo: 30, count: 4400, average: 4.4 },
      Array<number>(15).fill(40),
      4.6,
    ),
    ...grownRatingsPoints(
      { daysAgo: 14, count: 1000, average: 4.5 },
      Array<number>(14).fill(40),
      4.6,
    ),
  ],
};

export const RATINGS_HISTORY_SETS: Record<string, RatingsHistory> = {
  single: SINGLE_RATINGS_HISTORY,
  short: SHORT_RATINGS_HISTORY,
  drop: DROPPING_RATINGS_HISTORY,
  growth: GROWING_RATINGS_HISTORY,
  thin: THIN_RATINGS_HISTORY,
  reset: RESET_RATINGS_HISTORY,
};
