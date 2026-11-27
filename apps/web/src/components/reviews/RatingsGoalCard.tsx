"use client";

import { type ComponentProps, Suspense, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppDetail, Store } from "@asobeast/shared";
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
import { appDetailOptions } from "@/lib/queries";
import {
  DEFAULT_GOAL_DAYS,
  defaultTargetTenths,
  fiveStarRatingsToReach,
  MAX_GOAL_DAYS,
  MAX_TARGET_TENTHS,
  MIN_GOAL_DAYS,
  MIN_TARGET_TENTHS,
  parseGoalDays,
  parseTargetTenths,
} from "@/lib/ratings-goal";
import {
  DAYS_HINT,
  formatTenths,
  goalNotes,
  goalSentence,
  TARGET_HINT,
} from "./ratings-goal-copy";
import { GoalPace } from "./GoalPace";

type GoalFieldProps = {
  label: string;
  value: string;
  hintId: string | undefined;
  onValueChange: (value: string) => void;
} & Pick<ComponentProps<"input">, "inputMode" | "step" | "min" | "max">;

function GoalField({
  label,
  value,
  hintId,
  onValueChange,
  ...input
}: GoalFieldProps) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="number"
        value={value}
        aria-invalid={hintId !== undefined || undefined}
        aria-describedby={hintId}
        onChange={(event) => onValueChange(event.target.value)}
        {...input}
      />
    </div>
  );
}

function Hint({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="text-body text-muted-foreground">
      {text}
    </p>
  );
}

type StoredRating = { store: Store; average: number; count: number };

function storedRating(app: AppDetail | undefined): StoredRating | null {
  const snapshot = app?.latestSnapshot;
  if (!app || app.isCompetitor || !snapshot) return null;
  const { ratingAvg, ratingCount } = snapshot;
  if (ratingAvg === null || ratingCount === null) return null;
  return { store: app.store, average: ratingAvg, count: ratingCount };
}

function GoalAnswer({
  id,
  rating,
  target,
  days,
}: {
  id: string;
  rating: StoredRating;
  target: number;
  days: number;
}) {
  const goal = fiveStarRatingsToReach(
    rating.average,
    rating.count,
    target,
    days,
  );
  return (
    <>
      <p className="text-body">
        {goalSentence(goal, target, rating.average, days)}
      </p>
      {goal.kind === "needed" && rating.store === "APP_STORE" ? (
        <Suspense fallback={<span aria-hidden className="block h-lh" />}>
          <GoalPace id={id} targetTenths={target} days={days} />
        </Suspense>
      ) : null}
    </>
  );
}

function GoalResult({
  id,
  rating,
  target,
  days,
  targetHintId,
  daysHintId,
}: {
  id: string;
  rating: StoredRating;
  target: number | null;
  days: number | null;
  targetHintId: string;
  daysHintId: string;
}) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      {target === null ? <Hint id={targetHintId} text={TARGET_HINT} /> : null}
      {days === null ? <Hint id={daysHintId} text={DAYS_HINT} /> : null}
      {target === null || days === null ? null : (
        <GoalAnswer id={id} rating={rating} target={target} days={days} />
      )}
    </div>
  );
}

function GoalPanel({ id, rating }: { id: string; rating: StoredRating }) {
  const headingId = useId();
  const targetHintId = useId();
  const daysHintId = useId();
  const [targetText, setTargetText] = useState<string | null>(null);
  const [daysText, setDaysText] = useState(String(DEFAULT_GOAL_DAYS));

  const targetValue =
    targetText ??
    formatTenths(defaultTargetTenths(rating.average, rating.count));
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
            <GoalField
              label="Target rating"
              value={targetValue}
              hintId={target === null ? targetHintId : undefined}
              onValueChange={setTargetText}
              inputMode="decimal"
              step={0.1}
              min={MIN_TARGET_TENTHS / 10}
              max={MAX_TARGET_TENTHS / 10}
            />
            <GoalField
              label="Days"
              value={daysText}
              hintId={days === null ? daysHintId : undefined}
              onValueChange={setDaysText}
              inputMode="numeric"
              step={1}
              min={MIN_GOAL_DAYS}
              max={MAX_GOAL_DAYS}
            />
          </div>
          <GoalResult
            id={id}
            rating={rating}
            target={target}
            days={days}
            targetHintId={targetHintId}
            daysHintId={daysHintId}
          />
        </CardContent>
        <CardFooter className="flex-col items-start gap-1">
          {goalNotes(rating.store, rating.count).map((note) => (
            <span key={note}>{note}</span>
          ))}
        </CardFooter>
      </Card>
    </section>
  );
}

export function RatingsGoalCard({ id }: { id: string }) {
  const { data: app } = useQuery(appDetailOptions(id));
  const rating = storedRating(app);
  return rating ? <GoalPanel id={id} rating={rating} /> : null;
}
