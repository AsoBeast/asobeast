"use client";

import { useId } from "react";
import { CheckIcon } from "lucide-react";
import { REVIEW_SCORES } from "@asobeast/shared";
import type { ReviewScore, WebhookEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EVENT_LABELS, PICKER_EVENTS } from "./alert-event-copy";

const STARS_HELP =
  "A review arrives once, as a new review, when the stars ticked cover it. Negative review still covers the rest.";

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

export function EventSelection({
  value,
  onChange,
}: {
  value: WebhookEvent[];
  onChange: (next: WebhookEvent[]) => void;
}) {
  const labelId = useId();

  function toggle(event: WebhookEvent) {
    onChange(
      value.includes(event)
        ? value.filter((item) => item !== event)
        : [...value, event],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>Events</Label>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
      >
        {PICKER_EVENTS.map((event) => (
          <ToggleChip
            key={event}
            checked={value.includes(event)}
            onClick={() => toggle(event)}
          >
            {EVENT_LABELS[event]}
          </ToggleChip>
        ))}
      </div>
    </div>
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

export function AlertSubscriptionFields({
  events,
  stars,
  onEventsChange,
  onStarsChange,
}: {
  events: WebhookEvent[];
  stars: number[];
  onEventsChange: (next: WebhookEvent[]) => void;
  onStarsChange: (next: number[]) => void;
}) {
  return (
    <>
      <EventSelection value={events} onChange={onEventsChange} />
      {events.includes("review.new") ? (
        <ReviewStarSelection value={stars} onChange={onStarsChange} />
      ) : null}
    </>
  );
}
