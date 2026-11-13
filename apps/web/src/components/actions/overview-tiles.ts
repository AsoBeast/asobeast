import type {
  ActionActivity,
  ActionItem,
  ActionSummary,
} from "@asobeast/shared";
import { formatDate, formatNumber, pluralize } from "@/lib/format";

export interface OverviewTile {
  label: string;
  value: string;
  note: string;
  delta?: string;
}

const WEEK_DAYS = 7;
const NOT_GENERATED = "not generated yet";

function openNote(summary: ActionSummary): string {
  const { critical, high } = summary.openByPriority;
  if (summary.open === 0) return "nothing open";
  if (critical === 0 && high === 0) return "all medium or low";
  return `${formatNumber(critical)} critical · ${formatNumber(high)} high`;
}

const signed = (value: number): string =>
  value > 0 ? `+${formatNumber(value)}` : formatNumber(value);

const openedOn = (days: ActionActivity["days"]): number =>
  days.reduce((sum, day) => sum + day.opened + day.reopened, 0);

const closedOn = (days: ActionActivity["days"]): number =>
  days.reduce((sum, day) => sum + day.done + day.dismissed + day.resolved, 0);

function nextWake(items: readonly ActionItem[]): string {
  const dates = items
    .map((item) => item.snoozedUntil)
    .filter((date): date is string => date !== null)
    .sort();
  return dates.length > 0 ? `next wakes ${formatDate(dates[0])}` : "none";
}

export function overviewTiles(
  summary: ActionSummary,
  activity: ActionActivity,
  todo: readonly ActionItem[],
): OverviewTile[] {
  const week = activity.days.slice(-WEEK_DAYS);
  const weekBefore = activity.days.slice(-2 * WEEK_DAYS, -WEEK_DAYS);
  const opened = openedOn(week);
  const net = opened - closedOn(week);
  const growth = opened - openedOn(weekBefore);
  const tiles: OverviewTile[] = [
    {
      label: "Open",
      value: formatNumber(
        Object.values(summary.openByPriority).reduce((sum, n) => sum + n, 0),
      ),
      note: openNote(summary),
      ...(net === 0 ? {} : { delta: `${signed(net)} this week` }),
    },
    {
      label: "New this week",
      value: formatNumber(opened),
      note:
        weekBefore.length === WEEK_DAYS
          ? `${formatNumber(openedOn(weekBefore))} the week before`
          : `in ${pluralize(activity.days.length, "day")} of history`,
      ...(weekBefore.length === WEEK_DAYS && growth !== 0
        ? { delta: signed(growth) }
        : {}),
    },
    {
      label: "Confirmed fixed",
      value: formatNumber(activity.totals.verified),
      note: `${formatNumber(activity.totals.done)} marked done · ${activity.days.length} days`,
    },
    {
      label: "Snoozed",
      value: formatNumber(summary.snoozed),
      note: nextWake(todo.filter((item) => item.status === "SNOOZED")),
    },
  ];
  if (summary.generatedAt !== null) return tiles;
  return tiles.map(({ label }) => ({
    label,
    value: "—",
    note: NOT_GENERATED,
  }));
}
