"use client";

import { useId } from "react";
import { CheckIcon } from "lucide-react";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import type { WebhookEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const EVENT_LABELS: Record<WebhookEvent, string> = {
  "metadata.changed": "Metadata changed",
  "rank.dropped": "Rank dropped",
  "rank.improved": "Rank improved",
  "review.negative": "Negative review",
  "digest.weekly": "Weekly digest",
  "serp.entrant": "SERP entrant",
  "action.opened": "New action",
};

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
        {WEBHOOK_EVENTS.map((event) => {
          const checked = value.includes(event);
          return (
            <Button
              key={event}
              type="button"
              role="checkbox"
              aria-checked={checked}
              variant={checked ? "default" : "outline"}
              size="sm"
              onClick={() => toggle(event)}
            >
              <CheckIcon className={checked ? undefined : "invisible"} />
              {EVENT_LABELS[event]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
