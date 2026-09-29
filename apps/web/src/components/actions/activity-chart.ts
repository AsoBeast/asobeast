import type { ActionActivity } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

export const ACTIVITY_SERIES = [
  { key: "opened", label: "Opened" },
  { key: "closedByYou", label: "Closed by you" },
  { key: "resolved", label: "Resolved on its own" },
] as const;

export interface ActivityRow {
  date: string;
  opened: number;
  closedByYou: number;
  resolved: number;
}

export function activityRows(activity: ActionActivity): ActivityRow[] {
  return activity.days.map((day) => ({
    date: day.date,
    opened: day.opened + day.reopened,
    closedByYou: day.done + day.dismissed,
    resolved: day.resolved,
  }));
}

export function activityTotalsLine(activity: ActionActivity): string {
  const { totals } = activity;
  return [
    `${formatNumber(totals.opened + totals.reopened)} opened`,
    `${formatNumber(totals.done + totals.dismissed)} closed by you`,
    `${formatNumber(totals.resolved)} resolved on their own`,
    `${formatNumber(totals.verified)} confirmed fixed in ${activity.days.length} days`,
  ].join(" · ");
}

export function activeDays(activity: ActionActivity): number {
  return activityRows(activity).filter(
    (row) => row.opened + row.closedByYou + row.resolved > 0,
  ).length;
}
