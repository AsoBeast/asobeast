import type { ActionActivity } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enActions from "../../../messages/en/actions.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatNumber } from "@/lib/format";

const english = createTranslator({
  locale: "en",
  namespace: "actions",
  messages: { actions: enActions },
});

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

export function activityTotalsLine(
  activity: ActionActivity,
  t: MessageTranslator = english,
): string {
  const { totals } = activity;
  return [
    t("activity.opened", {
      count: formatNumber(totals.opened + totals.reopened),
    }),
    t("activity.closedByYou", {
      count: formatNumber(totals.done + totals.dismissed),
    }),
    t("activity.resolvedOwn", { count: formatNumber(totals.resolved) }),
    t("activity.confirmed", {
      count: formatNumber(totals.verified),
      days: activity.days.length,
    }),
  ].join(" · ");
}

export function activeDays(activity: ActionActivity): number {
  return activityRows(activity).filter(
    (row) => row.opened + row.closedByYou + row.resolved > 0,
  ).length;
}
