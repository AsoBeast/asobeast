"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatRating, pluralize } from "@/lib/format";
import { appDetailOptions } from "@/lib/queries";
import {
  DEFAULT_GOAL_DAYS,
  defaultTargetTenths,
  displayedRating,
  fiveStarRatingsToReach,
  parseGoalDays,
  parseTargetTenths,
  THIN_SAMPLE_COUNT,
} from "@/lib/ratings-goal";

function GoalSentence({
  target,
  average,
  count,
  days,
}: {
  target: number;
  average: number;
  count: number;
  days: number;
}) {
  const goal = fiveStarRatingsToReach(average, count, target, days);
  const shown = formatRating(target / 10);

  if (goal.kind === "reached") {
    return (
      <p className="text-body">
        {`The store already shows ${formatRating(displayedRating(average))}, which is ${shown} or more.`}
      </p>
    );
  }
  return (
    <p className="text-body">
      {`To show ${shown} you need ${formatNumber(goal.ratings)} more five star ${goal.ratings === 1 ? "rating" : "ratings"}, about ${formatNumber(goal.perDay)} a day for ${pluralize(days, "day")}.`}
    </p>
  );
}

export function RatingsGoalCard({ id }: { id: string }) {
  const headingId = useId();
  const targetId = useId();
  const daysId = useId();
  const { data: app } = useQuery(appDetailOptions(id));
  const [targetText, setTargetText] = useState<string | null>(null);
  const [daysText, setDaysText] = useState(String(DEFAULT_GOAL_DAYS));

  const snapshot = app?.latestSnapshot ?? null;
  const average = snapshot?.ratingAvg ?? null;
  const count = snapshot?.ratingCount ?? null;
  if (average === null || count === null) return null;

  const targetValue =
    targetText ?? formatRating(defaultTargetTenths(average) / 10);
  const target = parseTargetTenths(targetValue);
  const days = parseGoalDays(daysText);

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Ratings goal</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={targetId}>Target rating</Label>
              <Input
                id={targetId}
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0.1}
                max={5}
                value={targetValue}
                aria-invalid={target === null || undefined}
                onChange={(event) => setTargetText(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={daysId}>Days</Label>
              <Input
                id={daysId}
                type="number"
                inputMode="numeric"
                step={1}
                min={1}
                max={365}
                value={daysText}
                aria-invalid={days === null || undefined}
                onChange={(event) => setDaysText(event.target.value)}
              />
            </div>
          </div>
          {target === null || days === null ? (
            <p className="text-body text-muted-foreground">
              <span>
                Enter a target from 0.1 to 5.0 and a whole number of days from 1
                to 365.
              </span>
            </p>
          ) : (
            <GoalSentence
              target={target}
              average={average}
              count={count}
              days={days}
            />
          )}
        </CardContent>
        <CardFooter className="flex-col items-start gap-1">
          <span>
            Assumes every new rating is five stars, and that the store shows one
            decimal.
          </span>
          {count < THIN_SAMPLE_COUNT ? (
            <span>
              With fewer than 20 ratings the average moves a lot at this size.
            </span>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
