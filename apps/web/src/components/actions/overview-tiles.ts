import type {
  ActionActivity,
  ActionItem,
  ActionSummary,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatDateInLocale, formatNumber } from "@/lib/format";

export interface OverviewTile {
  label: string;
  value: string;
  note: string;
  delta?: string;
}

const WEEK_DAYS = 7;

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

function openNote(summary: ActionSummary, t: MessageTranslator): string {
  const { critical, high } = summary.openByPriority;
  if (summary.open === 0) return t("tiles.nothingOpen");
  if (critical === 0 && high === 0) return t("tiles.allMediumLow");
  return t("tiles.priorityCounts", {
    critical: formatNumber(critical),
    high: formatNumber(high),
  });
}

const signed = (value: number): string =>
  value > 0 ? `+${formatNumber(value)}` : formatNumber(value);

const openedOn = (days: ActionActivity["days"]): number =>
  days.reduce((sum, day) => sum + day.opened + day.reopened, 0);

function nextWake(
  items: readonly ActionItem[],
  snoozed: number,
  t: MessageTranslator,
  locale: Locale,
): string {
  const dates = items
    .map((item) => item.snoozedUntil)
    .filter((date): date is string => date !== null)
    .sort();
  if (dates.length > 0) {
    return t("tiles.nextWakes", { date: formatDateInLocale(dates[0], locale) });
  }
  return snoozed > 0 ? t("tiles.waitingWake") : t("tiles.none");
}

export function overviewTiles(
  summary: ActionSummary,
  activity: ActionActivity,
  todo: readonly ActionItem[],
  {
    t = english,
    locale = "en",
  }: {
    t?: MessageTranslator;
    locale?: Locale;
  } = {},
): OverviewTile[] {
  const week = activity.days.slice(-WEEK_DAYS);
  const weekBefore = activity.days.slice(-2 * WEEK_DAYS, -WEEK_DAYS);
  const opened = openedOn(week);
  const growth = opened - openedOn(weekBefore);
  const tiles: OverviewTile[] = [
    {
      label: t("tiles.open"),
      value: formatNumber(
        Object.values(summary.openByPriority).reduce((sum, n) => sum + n, 0),
      ),
      note: openNote(summary, t),
    },
    {
      label: t("tiles.newWeek"),
      value: formatNumber(opened),
      note:
        weekBefore.length === WEEK_DAYS
          ? t("tiles.weekBefore", { count: formatNumber(openedOn(weekBefore)) })
          : t("tiles.historyDays", { count: activity.days.length }),
      ...(weekBefore.length === WEEK_DAYS && growth !== 0
        ? { delta: signed(growth) }
        : {}),
    },
    {
      label: t("tiles.confirmed"),
      value: formatNumber(activity.totals.verified),
      note: t("tiles.markedDone", {
        count: formatNumber(activity.totals.done),
        days: t("days", { count: activity.days.length }),
      }),
    },
    {
      label: t("tiles.snoozed"),
      value: formatNumber(summary.snoozed),
      note: nextWake(
        todo.filter((item) => item.status === "SNOOZED"),
        summary.snoozed,
        t,
        locale,
      ),
    },
  ];
  if (summary.generatedAt !== null) return tiles;
  return tiles.map(({ label }) => ({
    label,
    value: "—",
    note: t("tiles.notGenerated"),
  }));
}
