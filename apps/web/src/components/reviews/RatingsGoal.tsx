"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { formatNumber, formatRating } from "@/lib/format";
import { appDetailOptions } from "@/lib/queries";
import {
  ratingGoalDefaultTarget,
  ratingGoalNeeded,
  RATING_GOAL_DEFAULT_DAYS,
  RATING_GOAL_NOTE_MAX_COUNT,
} from "@/lib/rating-goal";

function GoalField({
  label,
  value,
  onValid,
  step,
  min,
}: {
  label: string;
  value: number;
  onValid: (next: number) => void;
  step: number;
  min: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onValid(next);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

function ratingsPerDay(needed: number, days: number): number {
  return Math.ceil(needed / Math.max(days, 1));
}

export function RatingsGoal({ id }: { id: string }) {
  const headingId = useId();
  const { data } = useQuery(appDetailOptions(id));
  const [targetDraft, setTargetDraft] = useState<number | null>(null);
  const [daysDraft, setDaysDraft] = useState<number | null>(null);

  const snapshot = data?.latestSnapshot ?? null;
  const avg = snapshot?.ratingAvg ?? null;
  const count = snapshot?.ratingCount ?? null;

  if (avg === null || count === null) return null;

  const target = Math.min(targetDraft ?? ratingGoalDefaultTarget(avg), 5);
  const days = daysDraft ?? RATING_GOAL_DEFAULT_DAYS;
  const goal = ratingGoalNeeded(count, avg, target);
  const perDay =
    goal.kind === "needed" ? ratingsPerDay(goal.needed, days) : null;

  return (
    <section aria-labelledby={headingId}>
      <Card size="sm">
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Ratings goal</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <GoalField
              label="To show"
              value={target}
              onValid={setTargetDraft}
              step={0.1}
              min={0}
            />
            <GoalField
              label="Days"
              value={days}
              onValid={setDaysDraft}
              step={1}
              min={1}
            />
          </div>
          {goal.kind === "already" ? (
            <p className="text-body">
              <span>{`You already show ${formatRating(target)}`}</span>
              <span>.</span>
            </p>
          ) : (
            <p className="text-body">
              <span>{`To show ${formatRating(target)}`}</span>
              <span>
                {` you need ${formatNumber(goal.needed)} more five star ratings`}
              </span>
              {perDay === null ? null : (
                <span>{`, about ${formatNumber(perDay)} a day for ${days} days`}</span>
              )}
              <span>.</span>
            </p>
          )}
          {count < RATING_GOAL_NOTE_MAX_COUNT ? (
            <p className="text-caption text-muted-foreground">
              {`With ${formatNumber(count)} ratings the average moves a lot.`}
            </p>
          ) : null}
          <p className="text-caption text-muted-foreground">
            Assumes every new rating is five stars.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
