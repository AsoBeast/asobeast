"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
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

const PROGRESS: DivergingSubject = {
  region: "Actions opened and closed each day",
  waiting: "The chart fills in as actions open and close.",
  up: { label: "Opened", color: ACTION_COLORS.opened },
  down: { label: "Closed", color: ACTION_COLORS.closed },
};

function closedSplit(row: ActivityRow | undefined): SeriesTooltipItem[] {
  if (!row || row.closedByYou + row.resolved === 0) return [];
  return [
    {
      key: "closedByYou",
      index: 1,
      color: ACTION_COLORS.closed,
      label: "Closed by you",
      value: formatNumber(row.closedByYou),
      sortBy: 2,
    },
    {
      key: "resolved",
      index: 2,
      color: ACTION_COLORS.closed,
      label: "Resolved on its own",
      value: formatNumber(row.resolved),
      sortBy: 3,
    },
  ];
}

function progressOf(activity: ActionActivity) {
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
    details: (row: DivergingRow) => closedSplit(byDate.get(row.date)),
  };
}

function useProgress(appId?: string) {
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions(actionActivityScope(appId)),
  );
  return { activity, ...progressOf(activity) };
}

export function ActionProgressKey({ appId }: { appId?: string }) {
  const { trend } = useProgress(appId);
  return <DivergingKey trend={trend} subject={PROGRESS} />;
}

export function ActionProgress({ appId }: { appId?: string }) {
  const { trend, details } = useProgress(appId);
  return <DivergingBars trend={trend} subject={PROGRESS} details={details} />;
}

export function ActionProgressTotals({ appId }: { appId?: string }) {
  const { activity } = useProgress(appId);
  return <span>{activityTotalsLine(activity)}</span>;
}
