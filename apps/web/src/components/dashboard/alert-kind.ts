import type { AlertFeedEvent } from "@asobeast/shared";

type AlertKindTone = "up" | "down" | "flat";

export const ALERT_KINDS: Record<
  AlertFeedEvent,
  { word: string; tone: AlertKindTone }
> = {
  "metadata.changed": { word: "listing", tone: "flat" },
  "rank.dropped": { word: "fell", tone: "down" },
  "rank.improved": { word: "climbed", tone: "up" },
  "rank.milestone": { word: "milestone", tone: "up" },
  "rank.first": { word: "new", tone: "up" },
  "rank.overtaken": { word: "passed", tone: "down" },
  "review.negative": { word: "review", tone: "down" },
  "serp.entrant": { word: "entrant", tone: "flat" },
  "action.opened": { word: "action", tone: "flat" },
  "chart.entered": { word: "charted", tone: "up" },
  "chart.left": { word: "off chart", tone: "down" },
  "chart.milestone": { word: "chart", tone: "up" },
  "rating.dropped": { word: "rating", tone: "down" },
  "review.spike": { word: "reviews", tone: "flat" },
  "app.delisted": { word: "delisted", tone: "down" },
  "app.unlisted_market": { word: "unlisted", tone: "down" },
};
