import { utcDayOf, type ChangeEventItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enCompetitors from "../../../messages/en/competitors.json";
import type { MessageTranslator } from "@/i18n/translator";
import { changeFieldLabel } from "@/lib/change-field-label";
import { formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

export const LEDE_CHANGE_DAYS = 7;

export interface CompetitorLede {
  count: string;
  rest: string;
  changed: { name: string; rest: string } | null;
}

function countText(count: number, t: MessageTranslator): string {
  return count === 0 ? t("lede.none") : t("lede.count", { count });
}

function latestFirst(a: ChangeEventItem, b: ChangeEventItem): number {
  return b.capturedAt.localeCompare(a.capturedAt);
}

export function competitorLede(
  count: number,
  events: readonly ChangeEventItem[] | undefined,
  t: MessageTranslator = english,
  locale: Locale = "en",
): CompetitorLede {
  if (count === 0) {
    return {
      count: countText(count, t),
      rest: t("lede.emptyRest"),
      changed: null,
    };
  }
  if (events === undefined) {
    return {
      count: countText(count, t),
      rest: t("lede.tracked"),
      changed: null,
    };
  }
  const rivalEvents = events
    .filter((event) => event.isCompetitor)
    .sort(latestFirst);
  const latest = rivalEvents[0];
  if (latest === undefined) {
    return {
      count: countText(count, t),
      rest: t("lede.noChanges", { days: LEDE_CHANGE_DAYS }),
      changed: null,
    };
  }
  const changedApps = new Set(rivalEvents.map((event) => event.appId)).size;
  const changes = changeFieldLabel(latest.field, t);
  const field = locale === "en" ? changes.toLowerCase() : changes;
  const day = formatDayMonthInLocale(
    utcDayOf(new Date(latest.capturedAt)),
    locale,
  );
  const others =
    changedApps > 1
      ? t("lede.others", {
          count: changedApps - 1,
          days: LEDE_CHANGE_DAYS,
        })
      : "";
  return {
    count: countText(count, t),
    rest: t("lede.tracked"),
    changed: {
      name: latest.appName ?? t("unnamed"),
      rest: t("lede.changed", { field, day, others }),
    },
  };
}
