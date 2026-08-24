"use client";

import { WEBHOOK_EVENTS } from "@asobeast/shared";
import type { WebhookEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";

export const EVENT_LABELS: Record<WebhookEvent, string> = {
  "metadata.changed": "Metadata changed",
  "rank.dropped": "Rank dropped",
  "rank.improved": "Rank improved",
  "review.negative": "Negative review",
  "digest.weekly": "Weekly digest",
  "serp.entrant": "SERP entrant",
  "action.opened": "New action",
};

export function EventToggles({
  value,
  onChange,
}: {
  value: WebhookEvent[];
  onChange: (next: WebhookEvent[]) => void;
}) {
  function toggle(event: WebhookEvent) {
    onChange(
      value.includes(event)
        ? value.filter((item) => item !== event)
        : [...value, event],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {WEBHOOK_EVENTS.map((event) => {
        const active = value.includes(event);
        return (
          <Button
            key={event}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            aria-pressed={active}
            onClick={() => toggle(event)}
          >
            {EVENT_LABELS[event]}
          </Button>
        );
      })}
    </div>
  );
}
