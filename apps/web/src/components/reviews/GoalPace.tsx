"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ratedPoints } from "@/components/overview/rating-trend";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetToRange, type RatingsRange } from "@/lib/ranges";
import { goalAtCurrentMix } from "@/lib/ratings-goal";
import { paceSentence } from "./ratings-goal-copy";
import { newRatingsAverage } from "./ratings-volume";

const PACE_RANGE: RatingsRange = "30d";

export function GoalPace({
  id,
  targetTenths,
  days,
}: {
  id: string;
  targetTenths: number;
  days: number;
}) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(PACE_RANGE)),
  );
  const latest = ratedPoints(data.points).findLast(
    (point) => point.ratingCount !== null,
  );
  const found = newRatingsAverage(data.points);
  if (!latest || latest.ratingCount === null || !found) return null;
  const answer = goalAtCurrentMix({
    average: latest.ratingAvg,
    count: latest.ratingCount,
    newAverage: found.average,
    perDay: found.span > 0 ? found.added / found.span : 0,
    days,
    targetTenths,
  });
  return answer ? (
    <p className="text-body">{paceSentence(answer, targetTenths, days)}</p>
  ) : null;
}
