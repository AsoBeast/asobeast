import {
  CHANGE_FIELD_LABELS,
  utcDayOf,
  type ChangeEventItem,
} from "@asobeast/shared";
import { formatDayMonth } from "@/lib/format";
import { UNNAMED_COMPETITOR } from "./comparison-scores";

export const LEDE_CHANGE_DAYS = 7;

export interface CompetitorLede {
  count: string;
  rest: string;
  changed: { name: string; rest: string } | null;
}

function countText(count: number): string {
  if (count === 0) return "No competitors";
  return `${count} ${count === 1 ? "competitor" : "competitors"}`;
}

function latestFirst(a: ChangeEventItem, b: ChangeEventItem): number {
  return b.capturedAt.localeCompare(a.capturedAt);
}

export function competitorLede(
  count: number,
  events: readonly ChangeEventItem[],
): CompetitorLede {
  if (count === 0) {
    return {
      count: countText(count),
      rest: "tracked yet. Add the apps you rank against to see where they beat you.",
      changed: null,
    };
  }
  const rivalEvents = events
    .filter((event) => event.isCompetitor)
    .sort(latestFirst);
  const latest = rivalEvents[0];
  if (latest === undefined) {
    return {
      count: countText(count),
      rest: `tracked. No listing changes in the last ${LEDE_CHANGE_DAYS} days.`,
      changed: null,
    };
  }
  const changedApps = new Set(rivalEvents.map((event) => event.appId)).size;
  const field = CHANGE_FIELD_LABELS[latest.field].toLowerCase();
  const day = formatDayMonth(utcDayOf(new Date(latest.capturedAt)));
  const others =
    changedApps > 1
      ? ` ${changedApps - 1} more changed ${changedApps === 2 ? "its" : "their"} listing in the last ${LEDE_CHANGE_DAYS} days.`
      : "";
  return {
    count: countText(count),
    rest: "tracked.",
    changed: {
      name: latest.appName ?? UNNAMED_COMPETITOR,
      rest: `changed its ${field} on ${day}.${others}`,
    },
  };
}
