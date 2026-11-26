import type { AlertEventItem } from "@asobeast/shared";
import {
  eventLabel,
  EVENT_LABELS,
} from "@/components/settings/alert-event-copy";
import type { MessageTranslator } from "@/i18n/translator";
import { isNewSince } from "@/lib/alerts-seen";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { matchesSearch } from "@/lib/search-text";

export interface DayGroup {
  key: string;
  label: string;
  events: AlertEventItem[];
}

const DAY_MS = 86_400_000;

const utcDayOf = (instant: string | number): string =>
  new Date(instant).toISOString().slice(0, 10);

function dayLabel(
  day: string,
  now: number,
  locale: Locale,
  t?: MessageTranslator,
): string {
  if (day === utcDayOf(now)) return t ? t("today") : "Today";
  if (day === utcDayOf(now - DAY_MS)) return t ? t("yesterday") : "Yesterday";
  return formatDateInLocale(`${day}T00:00:00.000Z`, locale);
}

export function dayGroups(
  events: readonly AlertEventItem[],
  now: number,
  locale: Locale = "en",
  t?: MessageTranslator,
): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const key = utcDayOf(event.occurredAt);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.events.push(event);
    } else {
      groups.push({
        key,
        label: dayLabel(key, now, locale, t),
        events: [event],
      });
    }
  }
  return groups;
}

function searchParts(
  event: AlertEventItem,
  locale: Locale,
  t?: MessageTranslator,
): string[] {
  return [
    event.sentence,
    t ? eventLabel(event.event, t) : EVENT_LABELS[event.event],
    event.appName ?? "",
    event.country ? formatCountryInLocale(event.country, locale) : "",
  ];
}

export function searchEvents(
  events: readonly AlertEventItem[],
  query: string,
  locale: Locale = "en",
  t?: MessageTranslator,
): AlertEventItem[] {
  if (query.trim() === "") return [...events];
  return events.filter((event) =>
    matchesSearch(searchParts(event, locale, t), query),
  );
}

export interface FeedLede {
  figure: string | null;
  rest: string;
}

export function feedLede({
  events,
  seenAt,
  hasMore,
  locale = "en",
  t,
}: {
  events: readonly AlertEventItem[];
  seenAt: string | null;
  hasMore: boolean;
  locale?: Locale;
  t?: MessageTranslator;
}): FeedLede {
  const count = formatNumberInLocale(events.length, locale);
  if (seenAt === null) {
    const singular = events.length === 1 && !hasMore;
    const figure = t
      ? t(
          hasMore ? "ledeEventsOrMore" : singular ? "ledeEvent" : "ledeEvents",
          {
            count,
          },
        )
      : `${count}${hasMore ? " or more" : ""} ${singular ? "event" : "events"}`;
    return {
      figure,
      rest: t ? t("ledeInLast30") : " in the last 30 days",
    };
  }
  const fresh = events.filter((event) =>
    isNewSince(event.occurredAt, seenAt),
  ).length;
  if (fresh === 0) {
    return {
      figure: null,
      rest: t ? t("ledeNothingNew") : "Nothing new since your last visit",
    };
  }
  return {
    figure: t
      ? t(fresh === events.length && hasMore ? "ledeNewOrMore" : "ledeNew", {
          count: formatNumberInLocale(fresh, locale),
        })
      : `${formatNumberInLocale(fresh, locale)}${fresh === events.length && hasMore ? " or more" : ""} new`,
    rest: t ? t("ledeSinceVisit") : " since your last visit",
  };
}
