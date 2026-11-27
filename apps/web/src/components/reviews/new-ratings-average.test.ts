import { describe, expect, it } from "vitest";
import {
  RATING_STARS,
  type RatingCounts,
  type RatingsPoint,
  type RatingStar,
} from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";
import {
  hasStarCountReads,
  newRatingsAverage,
  newRatingsAverageFor,
  newRatingsAverageSeries,
  newRatingsAverageSeriesFor,
} from "./new-ratings-average";

const point = (
  date: string,
  ratingCount: number | null,
  ratingAvg: number | null = 4.5,
): RatingsPoint => ({
  date,
  ratingAvg,
  ratingCount,
});

interface Listing {
  date: string;
  count: number;
  average: number;
}

function grown(
  start: Listing,
  days: number,
  perDay: number,
  mean: number,
): RatingsPoint[] {
  const points = [point(start.date, start.count, start.average)];
  let { count, average } = start;
  for (let day = 1; day <= days; day += 1) {
    const next = count + perDay;
    average = (average * count + mean * perDay) / next;
    count = next;
    points.push(point(dayBefore(start.date, -day), count, average));
  }
  return points;
}

const lastListing = (points: readonly RatingsPoint[]): Listing => {
  const last = points[points.length - 1];
  return {
    date: last.date,
    count: last.ratingCount ?? 0,
    average: last.ratingAvg ?? 0,
  };
};

const roundedLikeTheStore = (points: readonly RatingsPoint[]) =>
  points.map((each) => ({
    ...each,
    ratingAvg:
      each.ratingAvg === null ? null : Number(each.ratingAvg.toFixed(5)),
  }));

const START = { date: "2026-10-01", count: 2000, average: 4.3 };

describe("newRatingsAverage", () => {
  it("averages the ratings added", () => {
    const answer = newRatingsAverage(grown(START, 30, 40, 4.7));

    expect(answer?.average).toBeCloseTo(4.7, 6);
    expect(answer?.added).toBe(1200);
    expect(answer?.span).toBe(30);
  });

  it("answers nothing with fewer than five new ratings", () => {
    expect(newRatingsAverage(grown(START, 4, 1, 4.7))).toBeNull();
    expect(newRatingsAverage(grown(START, 5, 1, 4.7))?.added).toBe(5);
  });

  it("answers nothing when rounding could move it by more than a twentieth of a star", () => {
    const big = { date: "2026-10-01", count: 200_000, average: 4.3 };

    expect(
      newRatingsAverage(roundedLikeTheStore(grown(big, 20, 1, 4.7))),
    ).toBeNull();
    expect(
      newRatingsAverage(roundedLikeTheStore(grown(big, 20, 3, 4.7)))?.average,
    ).toBeCloseTo(4.7, 1);
  });

  it("breaks the series where the count drops", () => {
    const before = grown(
      { date: "2026-10-01", count: 4200, average: 4.4 },
      20,
      40,
      4.6,
    );
    const resetDay = dayBefore(lastListing(before).date, -1);
    const after = grown(
      { date: resetDay, count: 1000, average: 4.5 },
      10,
      40,
      4.6,
    );
    const answer = newRatingsAverage([...before, ...after]);

    expect(lastListing(before).count).toBe(5000);
    expect(answer?.average).toBeCloseTo(4.6, 6);
    expect(answer?.added).toBe(1200);
  });

  it("skips points without a count or an average", () => {
    const points = grown(START, 10, 40, 4.7);
    const gaps = points.map((each, index) =>
      index === 3
        ? { ...each, ratingCount: null }
        : index === 6
          ? { ...each, ratingAvg: null }
          : each,
    );

    expect(newRatingsAverage(gaps)?.average).toBeCloseTo(4.7, 6);
    expect(newRatingsAverage(gaps)?.added).toBe(400);
  });

  it("adds nothing for days the count repeats", () => {
    const growing = grown(START, 5, 40, 4.7);
    const quiet = grown(lastListing(growing), 5, 0, 4.7).slice(1);
    const answer = newRatingsAverage([...growing, ...quiet]);

    expect(answer?.average).toBeCloseTo(4.7, 6);
    expect(answer?.added).toBe(200);
    expect(answer?.span).toBe(10);
  });

  it("leaves out a stretch where only the average moves", () => {
    const growing = grown(START, 10, 40, 4.7);
    const after = lastListing(growing).date;
    const edited = [4.0, 4.1, 4.2].map((average, index) =>
      point(dayBefore(after, -(index + 1)), 1000, average),
    );
    const answer = newRatingsAverage([...growing, ...edited]);

    expect(answer?.average).toBeCloseTo(4.7, 6);
    expect(answer?.added).toBe(400);
  });

  it("answers nothing outside one to five stars", () => {
    expect(newRatingsAverage(grown(START, 2, 40, 5.6))).toBeNull();
    expect(newRatingsAverage(grown(START, 2, 40, 0.6))).toBeNull();
  });

  it("answers nothing for one point", () => {
    expect(newRatingsAverage(grown(START, 0, 40, 4.7))).toBeNull();
    expect(newRatingsAverage([])).toBeNull();
  });
});

describe("newRatingsAverageSeries", () => {
  it("starts on the first day with a full week behind it", () => {
    const series = newRatingsAverageSeries(grown(START, 30, 40, 4.7));

    expect(series).toHaveLength(31);
    expect(series.slice(0, 7).map((each) => each.average)).toEqual(
      Array(7).fill(null),
    );
    expect(series[7].date).toBe("2026-10-08");
    for (const each of series.slice(7)) {
      expect(each.average).toBeCloseTo(4.7, 6);
    }
  });

  it("leaves a day without enough new ratings empty", () => {
    const growing = grown(START, 10, 40, 4.7);
    const quiet = grown(lastListing(growing), 10, 0, 4.7).slice(1);
    const resumed = grown(lastListing(quiet), 10, 40, 4.7).slice(1);
    const series = newRatingsAverageSeries([...growing, ...quiet, ...resumed]);
    const byDate = new Map(series.map((each) => [each.date, each.average]));

    expect(byDate.get(lastListing(growing).date)).toBeCloseTo(4.7, 6);
    expect(byDate.get(lastListing(quiet).date)).toBeNull();
    expect(byDate.get(lastListing(resumed).date)).toBeCloseTo(4.7, 6);
  });

  it("breaks the line for a week where the count drops", () => {
    const before = grown(
      { date: "2026-10-01", count: 4400, average: 4.4 },
      15,
      40,
      4.6,
    );
    const after = grown(
      {
        date: dayBefore(lastListing(before).date, -1),
        count: 1000,
        average: 4.5,
      },
      15,
      40,
      4.6,
    );
    const series = newRatingsAverageSeries([...before, ...after]);
    const byDate = new Map(series.map((each) => [each.date, each.average]));
    const gap = Array.from({ length: 7 }, (_, day) =>
      byDate.get(dayBefore("2026-10-17", -day)),
    );

    expect(byDate.get("2026-10-16")).toBeCloseTo(4.6, 6);
    expect(gap).toEqual(Array(7).fill(null));
    expect(byDate.get("2026-10-24")).toBeCloseTo(4.6, 6);
    for (const each of series) {
      if (each.average !== null) expect(each.average).toBeCloseTo(4.6, 6);
    }
  });

  it("breaks the line at a drop read on a day without an average", () => {
    const points = [
      point("2026-10-01", 2000, 4.3),
      point("2026-10-08", 2280, 4.3),
      point("2026-10-09", 2200, null),
      point("2026-10-10", 2320, 4.3),
    ];
    const byDate = new Map(
      newRatingsAverageSeries(points).map((each) => [each.date, each.average]),
    );

    expect(byDate.get("2026-10-08")).toBeCloseTo(4.3, 6);
    expect(byDate.get("2026-10-10")).toBeNull();
    expect(newRatingsAverage(points)?.added).toBe(280);
  });

  it("bridges days the store reported no count", () => {
    const points = grown(START, 20, 40, 4.7).map((each, index) =>
      index >= 9 && index <= 11 ? { ...each, ratingCount: null } : each,
    );
    const byDate = new Map(
      newRatingsAverageSeries(points).map((each) => [each.date, each.average]),
    );

    expect(byDate.get("2026-10-14")).toBeCloseTo(4.7, 6);
    expect(byDate.get("2026-10-16")).toBeCloseTo(4.7, 6);
  });
});

type Weights = readonly [number, number, number, number, number];

function splitStars(total: number, weights: Weights): RatingCounts {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = {} as RatingCounts;
  let assigned = 0;
  RATING_STARS.forEach((star, index) => {
    counts[star] =
      star === "5"
        ? total - assigned
        : Math.floor((total * weights[index]) / weightSum);
    assigned += counts[star];
  });
  return counts;
}

const starsTotal = (counts: RatingCounts): number =>
  RATING_STARS.reduce((sum, star) => sum + counts[star], 0);

const meanOf = (counts: RatingCounts): number =>
  RATING_STARS.reduce((sum, star) => sum + Number(star) * counts[star], 0) /
  starsTotal(counts);

const plus = (left: RatingCounts, right: RatingCounts): RatingCounts => {
  const counts = {} as RatingCounts;
  for (const star of RATING_STARS) counts[star] = left[star] + right[star];
  return counts;
};

const shift = (
  counts: RatingCounts,
  from: RatingStar,
  to: RatingStar,
  moved: number,
): RatingCounts => ({
  ...counts,
  [from]: counts[from] - moved,
  [to]: counts[to] + moved,
});

const playPoint = (
  date: string,
  counts: RatingCounts,
  ratingCount: number | null = starsTotal(counts),
): RatingsPoint => ({
  date,
  ratingAvg: meanOf(counts),
  ratingCount,
  starCounts: counts,
});

const withoutStarCounts = ({
  date,
  ratingAvg,
  ratingCount,
}: RatingsPoint): RatingsPoint => ({ date, ratingAvg, ratingCount });

function playGrown(
  start: { date: string; counts: RatingCounts },
  days: number,
  perDay: RatingCounts,
): RatingsPoint[] {
  const points = [playPoint(start.date, start.counts)];
  let counts = start.counts;
  for (let day = 1; day <= days; day += 1) {
    counts = plus(counts, perDay);
    points.push(playPoint(dayBefore(start.date, -day), counts));
  }
  return points;
}

const PLAY_START = {
  date: "2026-10-01",
  counts: splitStars(2000, [10, 10, 10, 20, 50]),
};
const DAILY = splitStars(40, [1, 0, 1, 6, 32]);
const FOUR_SIXTY = splitStars(40, [0, 0, 0, 40, 60]);
const SPREAD: Weights = [2, 3, 5, 20, 70];
const ONE_FIVE_STAR = splitStars(1, [0, 0, 0, 0, 1]);

const playReset = () => ({
  before: playGrown(
    { date: "2026-10-01", counts: splitStars(5000, SPREAD) },
    10,
    FOUR_SIXTY,
  ),
  after: playGrown(
    { date: "2026-10-12", counts: splitStars(1000, SPREAD) },
    10,
    FOUR_SIXTY,
  ),
});

describe("newRatingsAverageFor on Google Play", () => {
  it("averages the ratings added from the counts per star", () => {
    const answer = newRatingsAverageFor(
      "GOOGLE_PLAY",
      playGrown(PLAY_START, 30, DAILY),
    );

    expect(answer?.average).toBeCloseTo(meanOf(DAILY), 9);
    expect(answer?.added).toBe(1200);
    expect(answer?.span).toBe(30);
  });

  it("needs no rounding allowance", () => {
    const big = { date: "2026-10-01", counts: splitStars(200_000, SPREAD) };
    const points = playGrown(big, 20, ONE_FIVE_STAR);

    expect(newRatingsAverageFor("GOOGLE_PLAY", points)?.added).toBe(20);
    expect(
      newRatingsAverageFor("APP_STORE", roundedLikeTheStore(points)),
    ).toBeNull();
  });

  const START_COUNTS = splitStars(100, [10, 0, 0, 0, 90]);

  const movedDay = (end: RatingCounts) => [
    playPoint("2026-10-01", START_COUNTS),
    playPoint("2026-10-02", end),
  ];

  it("nets a rating that moved between stars", () => {
    const end = shift(
      plus(START_COUNTS, splitStars(10, [0, 0, 50, 0, 50])),
      "1",
      "5",
      1,
    );
    const answer = newRatingsAverageFor("GOOGLE_PLAY", movedDay(end));

    expect(answer?.average).toBeCloseTo(4.4, 9);
    expect(answer?.added).toBe(10);
  });

  it("answers nothing when the net change lands outside one to five stars", () => {
    const end = shift(
      plus(START_COUNTS, splitStars(10, [0, 0, 0, 0, 100])),
      "1",
      "5",
      1,
    );

    expect(newRatingsAverageFor("GOOGLE_PLAY", movedDay(end))).toBeNull();
  });

  it("adds nothing for a rating that only moved between stars", () => {
    const end = shift(START_COUNTS, "1", "5", 1);

    expect(newRatingsAverageFor("GOOGLE_PLAY", movedDay(end))).toBeNull();
  });

  it("starts over where the star total drops", () => {
    const { before, after } = playReset();
    const answer = newRatingsAverageFor("GOOGLE_PLAY", [...before, ...after]);

    expect(answer?.average).toBeCloseTo(meanOf(FOUR_SIXTY), 9);
    expect(answer?.added).toBe(800);
  });

  it("answers nothing with fewer than five new ratings", () => {
    expect(
      newRatingsAverageFor(
        "GOOGLE_PLAY",
        playGrown(PLAY_START, 4, ONE_FIVE_STAR),
      ),
    ).toBeNull();
    expect(
      newRatingsAverageFor(
        "GOOGLE_PLAY",
        playGrown(PLAY_START, 5, ONE_FIVE_STAR),
      )?.added,
    ).toBe(5);
  });

  it("reads the star total and never the rating count", () => {
    const points = playGrown(PLAY_START, 30, DAILY);
    const noisy = points.map((each, index) => ({
      ...each,
      ratingCount: index % 2 === 0 ? 100 : 5000,
    }));
    const blank = points.map((each) => ({ ...each, ratingCount: null }));
    const expected = newRatingsAverageFor("GOOGLE_PLAY", points);

    expect(newRatingsAverageFor("GOOGLE_PLAY", noisy)).toEqual(expected);
    expect(newRatingsAverageFor("GOOGLE_PLAY", blank)).toEqual(expected);
  });

  it("skips a point without star counts", () => {
    const points = playGrown(PLAY_START, 30, DAILY);
    const gaps = points.map((each, index) =>
      index >= 1 && index <= 29 ? withoutStarCounts(each) : each,
    );

    expect(newRatingsAverageFor("GOOGLE_PLAY", gaps)).toEqual(
      newRatingsAverageFor("GOOGLE_PLAY", points),
    );
  });

  it("answers nothing when no point carries star counts", () => {
    const stripped = playGrown(PLAY_START, 30, DAILY).map(withoutStarCounts);

    expect(newRatingsAverageFor("GOOGLE_PLAY", stripped)).toBeNull();
    expect(newRatingsAverageFor("APP_STORE", stripped)).not.toBeNull();
  });

  it("reads the average and count on the App Store, whatever else a point carries", () => {
    const points = playGrown(PLAY_START, 30, DAILY);

    expect(newRatingsAverageFor("APP_STORE", points)).toEqual(
      newRatingsAverage(points),
    );
  });
});

describe("newRatingsAverageSeriesFor on Google Play", () => {
  it("starts on the first day with a full week behind it", () => {
    const series = newRatingsAverageSeriesFor(
      "GOOGLE_PLAY",
      playGrown(PLAY_START, 30, DAILY),
    );

    expect(series).toHaveLength(31);
    expect(series.slice(0, 7).every((each) => each.average === null)).toBe(
      true,
    );
    expect(series[7].date).toBe("2026-10-08");
    for (const each of series.slice(7)) {
      expect(each.average).toBeCloseTo(meanOf(DAILY), 9);
    }
  });

  it("breaks the line for a week where the star total drops", () => {
    const { before, after } = playReset();
    const series = newRatingsAverageSeriesFor("GOOGLE_PLAY", [
      ...before,
      ...after,
    ]);
    const byDate = new Map(series.map((each) => [each.date, each.average]));
    const gap = Array.from({ length: 7 }, (_, day) =>
      byDate.get(dayBefore("2026-10-12", -day)),
    );

    expect(byDate.get("2026-10-11")).toBeCloseTo(meanOf(FOUR_SIXTY), 9);
    expect(gap).toEqual(Array(7).fill(null));
    expect(byDate.get("2026-10-19")).toBeCloseTo(meanOf(FOUR_SIXTY), 9);
    for (const each of series) {
      if (each.average !== null) {
        expect(each.average).toBeCloseTo(meanOf(FOUR_SIXTY), 9);
      }
    }
  });

  it("leaves a day without star counts out of the line", () => {
    const points = playGrown(PLAY_START, 30, DAILY);
    const thatDate = points[15].date;
    const series = newRatingsAverageSeriesFor(
      "GOOGLE_PLAY",
      points.map((each, index) =>
        index === 15 ? withoutStarCounts(each) : each,
      ),
    );
    const byDate = new Map(series.map((each) => [each.date, each.average]));

    expect(series.some((each) => each.date === thatDate)).toBe(false);
    expect(byDate.get(points[14].date)).toBeCloseTo(meanOf(DAILY), 9);
    expect(byDate.get(points[16].date)).toBeCloseTo(meanOf(DAILY), 9);
  });

  it("reaches back to the last day with star counts at the start of a week", () => {
    const ones = splitStars(70, [1, 0, 0, 0, 0]);
    const fives = splitStars(10, [0, 0, 0, 0, 1]);
    const first = PLAY_START.counts;
    const eighth = plus(first, DAILY);
    const fifteenth = plus(eighth, ones);
    const sixteenth = plus(fifteenth, fives);
    const byDate = new Map(
      newRatingsAverageSeriesFor("GOOGLE_PLAY", [
        playPoint("2026-10-01", first),
        playPoint("2026-10-08", eighth),
        playPoint("2026-10-15", fifteenth),
        playPoint("2026-10-16", sixteenth),
      ]).map((each) => [each.date, each.average]),
    );

    expect(byDate.get("2026-10-15")).toBeCloseTo(meanOf(ones), 9);
    expect(byDate.get("2026-10-16")).toBeCloseTo(meanOf(plus(ones, fives)), 9);
  });

  it("draws nothing without star counts", () => {
    expect(
      newRatingsAverageSeriesFor(
        "GOOGLE_PLAY",
        playGrown(PLAY_START, 30, DAILY).map(withoutStarCounts),
      ),
    ).toEqual([]);
  });
});

describe("hasStarCountReads", () => {
  it("is true when at least two points carry star counts", () => {
    expect(hasStarCountReads(playGrown(PLAY_START, 3, DAILY))).toBe(true);
  });

  it("is false with one", () => {
    expect(
      hasStarCountReads([playPoint(PLAY_START.date, PLAY_START.counts)]),
    ).toBe(false);
  });

  it("is false with none", () => {
    expect(hasStarCountReads([])).toBe(false);
    expect(
      hasStarCountReads(playGrown(PLAY_START, 3, DAILY).map(withoutStarCounts)),
    ).toBe(false);
  });
});
