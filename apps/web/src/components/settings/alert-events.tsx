"use client";

import { useId } from "react";
import { CheckIcon } from "lucide-react";
import {
  RATING_DROP_TENTHS_CHOICES,
  REVIEW_SCORES,
  ratingDropLabel,
} from "@asobeast/shared";
import type { ReviewScore } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseRankDropThreshold } from "./alert-thresholds";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STARS_HELP =
  "Reviews with these stars arrive as new reviews. When Negative review is ticked too, a low review outside these stars still arrives as a negative review.";

function ToggleChip({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      role="checkbox"
      aria-checked={checked}
      variant={checked ? "default" : "outline"}
      size="sm"
      onClick={onClick}
    >
      <CheckIcon className={checked ? undefined : "invisible"} />
      {children}
    </Button>
  );
}

export function ReviewStarSelection({
  value,
  onChange,
}: {
  value: readonly number[];
  onChange: (next: number[]) => void;
}) {
  const labelId = useId();
  const helpId = useId();

  function toggle(score: ReviewScore) {
    onChange(
      value.includes(score)
        ? value.filter((item) => item !== score)
        : [...value, score].sort((left, right) => left - right),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>New review stars</Label>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={helpId}
        className="flex flex-wrap gap-2"
      >
        {REVIEW_SCORES.map((score) => (
          <ToggleChip
            key={score}
            checked={value.includes(score)}
            onClick={() => toggle(score)}
          >
            {score === 1 ? "1 star" : `${score} stars`}
          </ToggleChip>
        ))}
      </div>
      <p id={helpId} className="text-sm text-muted-foreground">
        {value.length === 0 ? "Pick at least one star." : STARS_HELP}
      </p>
    </div>
  );
}

const RATING_DROP_HELP =
  "Alert when the average rating falls by at least this much against seven days earlier. Needs 20 ratings. Reviews are not counted, the number shown in the store is.";

const ratingDropChoices = (value: number): number[] =>
  [...new Set<number>([...RATING_DROP_TENTHS_CHOICES, value])].sort(
    (left, right) => left - right,
  );

export function RatingDropSelection({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const triggerId = useId();
  const helpId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={triggerId}>Rating drop threshold</Label>
      <Select
        value={String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger
          id={triggerId}
          aria-describedby={helpId}
          className="w-[160px]"
        >
          <SelectValue>{ratingDropLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ratingDropChoices(value).map((tenths) => (
            <SelectItem key={tenths} value={String(tenths)}>
              {ratingDropLabel(tenths)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={helpId} className="text-sm text-muted-foreground">
        {RATING_DROP_HELP}
      </p>
    </div>
  );
}

const rankHelp = (instance: number | null): string =>
  instance === null
    ? "Leave empty to use the instance value. A smaller value counts as the lowest value this instance detects."
    : `Leave empty to use the instance value, ${instance}. A smaller value counts as ${instance}, the lowest value this instance detects.`;

export function RankDropField({
  value,
  onChange,
  instance,
}: {
  value: string;
  onChange: (next: string) => void;
  instance: number | null;
}) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const { error } = parseRankDropThreshold(value);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Rank drop positions</Label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={instance === null ? undefined : String(instance)}
          aria-invalid={error !== null}
          aria-describedby={error ? `${errorId} ${helpId}` : helpId}
          className="w-24"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="text-sm text-muted-foreground">positions</span>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p id={helpId} className="text-sm text-muted-foreground">
        {rankHelp(instance)}
      </p>
    </div>
  );
}
