"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ActionActivity } from "@asobeast/shared";
import {
  DivergingBars,
  DivergingKey,
  type DivergingSubject,
} from "@/components/charts/DivergingBars";
import {
  divergingTrend,
  type DivergingRow,
} from "@/components/charts/diverging-trend";
import type { SeriesTooltipItem } from "@/components/charts/SeriesTooltip";
import { ACTION_COLORS } from "@/components/charts/theme";
import { actionActivityScope } from "@/lib/action-filters";
import { formatNumber } from "@/lib/format";
import { actionActivityOptions } from "@/lib/queries";
import {
  activeDays,
  activityRows,
  activityTotalsLine,
  type ActivityRow,
} from "./activity-chart";

function progressSubject(
  t: ReturnType<typeof useTranslations>,
): DivergingSubject {
  return {
    region: t("progressChart.region"),
    waiting: t("progressChart.waiting"),
    up: { label: t("progressChart.opened"), color: ACTION_COLORS.opened },
    down: { label: t("progressChart.closed"), color: ACTION_COLORS.closed },
  };
}

function closedSplit(
  row: ActivityRow | undefined,
  t: ReturnType<typeof useTranslations>,
): SeriesTooltipItem[] {
  if (!row || row.closedByYou + row.resolved === 0) return [];
  return [
    {
      key: "closedByYou",
      index: 1,
      color: ACTION_COLORS.closed,
      label: t("progressChart.closedByYou"),
      value: formatNumber(row.closedByYou),
      sortBy: 2,
    },
    {
      key: "resolved",
      index: 2,
      color: ACTION_COLORS.closed,
      label: t("progressChart.resolvedOwn"),
      value: formatNumber(row.resolved),
      sortBy: 3,
    },
  ];
}

function progressOf(
  activity: ActionActivity,
  t: ReturnType<typeof useTranslations>,
) {
  const rows = activityRows(activity);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return {
    trend: divergingTrend(
      rows.map((row) => ({
        date: row.date,
        up: row.opened,
        down: row.closedByYou + row.resolved,
      })),
      activity.days.length,
      activeDays(activity),
    ),
    details: (row: DivergingRow) => closedSplit(byDate.get(row.date), t),
  };
}

function useActivity(appId?: string): ActionActivity {
  return useSuspenseQuery(actionActivityOptions(actionActivityScope(appId)))
    .data;
}

export function ActionProgressKey({ appId }: { appId?: string }) {
  const t = useTranslations("actions");
  const { trend } = progressOf(useActivity(appId), t);
  return <DivergingKey trend={trend} subject={progressSubject(t)} />;
}

export function ActionProgress({ appId }: { appId?: string }) {
  const t = useTranslations("actions");
  const { trend, details } = progressOf(useActivity(appId), t);
  return (
    <DivergingBars
      trend={trend}
      subject={progressSubject(t)}
      details={details}
    />
  );
}

export function ActionProgressTotals({ appId }: { appId?: string }) {
  const t = useTranslations("actions");
  return <span>{activityTotalsLine(useActivity(appId), t)}</span>;
}
