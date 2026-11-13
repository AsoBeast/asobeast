import type { AlertEventItem } from "@asobeast/shared";
import { EVENT_LABELS } from "@/components/settings/alert-event-copy";
import { isNewSince } from "@/lib/alerts-seen";
import { formatCountry, formatDate } from "@/lib/format";
import { matchesSearch } from "@/lib/search-text";

export interface DayGroup {
  key: string;
  label: string;
  events: AlertEventItem[];
}

const DAY_MS = 86_400_000;

const utcDayOf = (instant: string | number): string =>
  new Date(instant).toISOString().slice(0, 10);

function dayLabel(day: string, now: number): string {
  if (day === utcDayOf(now)) return "Today";
  if (day === utcDayOf(now - DAY_MS)) return "Yesterday";
  return formatDate(`${day}T00:00:00.000Z`);
}

export function dayGroups(
  events: readonly AlertEventItem[],
  now: number,
): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const key = utcDayOf(event.occurredAt);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, label: dayLabel(key, now), events: [event] });
    }
  }
  return groups;
}

function searchParts(event: AlertEventItem): string[] {
  return [
    event.sentence,
    EVENT_LABELS[event.event],
    event.appName ?? "",
    event.country ? formatCountry(event.country) : "",
  ];
}

export function searchEvents(
  events: readonly AlertEventItem[],
  query: string,
): AlertEventItem[] {
  if (query.trim() === "") return [...events];
  return events.filter((event) => matchesSearch(searchParts(event), query));
}

export interface FeedLede {
  figure: string | null;
  rest: string;
}

export function feedLede({
  events,
  seenAt,
  hasMore,
}: {
  events: readonly AlertEventItem[];
  seenAt: string | null;
  hasMore: boolean;
}): FeedLede {
  const orMore = hasMore ? " or more" : "";
  if (seenAt === null) {
    const noun = events.length === 1 && !hasMore ? "event" : "events";
    return {
      figure: `${events.length}${orMore} ${noun}`,
      rest: " in the last 30 days",
    };
  }
  const fresh = events.filter((event) =>
    isNewSince(event.occurredAt, seenAt),
  ).length;
  if (fresh === 0) {
    return { figure: null, rest: "Nothing new since your last visit" };
  }
  return {
    figure: `${fresh}${fresh === events.length ? orMore : ""} new`,
    rest: " since your last visit",
  };
}
