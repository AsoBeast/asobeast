"use client";

import { Suspense, useDeferredValue, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionActivity, PortfolioHistoryDays } from "@asobeast/shared";
import { activeDays, activityRows } from "@/components/actions/activity-chart";
import { ACTION_COLORS, MOVEMENT_COLORS } from "@/components/charts/theme";
import {
  actionActivityOptions,
  portfolioHistoryOptions,
  runStatusOptions,
} from "@/lib/queries";
import type { DashboardMetric } from "@/lib/search-params";
import {
  type DailyPair,
  type DivergingTrend,
  divergingTrend,
  historyTrend,
  movementPairs,
  unfinishedSince,
} from "./history-trend";
import {
  DivergingBars,
  DivergingKey,
  type DivergingSubject,
} from "./DivergingBars";
import {
  PortfolioTrendChart,
  TrendLegend,
  type TrendSubject,
} from "./PortfolioTrendChart";
import { MetricPanelSkeleton } from "./skeletons";
import { useDashboardRange } from "./use-range-history";

type HistoryMetric = Exclude<DashboardMetric, "actions">;

const SUBJECTS: Record<Exclude<HistoryMetric, "moved">, TrendSubject> = {
  visibility: {
    label: "Visibility",
    region: "Visibility across your apps",
    counted: false,
  },
  top10: {
    label: "In the top 10",
    region: "Keywords in the top 10",
    counted: true,
  },
};

function Frame({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-label font-medium text-muted-foreground">{title}</p>
        {legend}
      </div>
      {children}
    </div>
  );
}

const MOVEMENT: DivergingSubject = {
  region: "Keywords that climbed and fell each day",
  waiting: "Daily movement appears after a few daily runs.",
  up: { label: "Climbed", color: MOVEMENT_COLORS.climbed },
  down: { label: "Fell", color: MOVEMENT_COLORS.fell },
};

const ACTIONS: DivergingSubject = {
  region: "Actions opened and closed each day",
  waiting: "The chart fills in as actions open and close.",
  up: { label: "Opened", color: ACTION_COLORS.opened },
  down: { label: "Closed", color: ACTION_COLORS.closed },
};

const actionPairs = (activity: ActionActivity): DailyPair[] =>
  activityRows(activity).map((row) => ({
    date: row.date,
    up: row.opened,
    down: row.closedByYou + row.resolved,
  }));

function DivergingPanel({
  trend,
  subject,
}: {
  trend: DivergingTrend;
  subject: DivergingSubject;
}) {
  return (
    <Frame
      title={subject.region}
      legend={<DivergingKey trend={trend} subject={subject} />}
    >
      <DivergingBars trend={trend} subject={subject} />
    </Frame>
  );
}

function HistoryPanel({
  metric,
  days,
}: {
  metric: HistoryMetric;
  days: PortfolioHistoryDays;
}) {
  const { data: history } = useSuspenseQuery(portfolioHistoryOptions(days));
  const { data: run } = useSuspenseQuery(runStatusOptions);

  if (metric === "moved") {
    return (
      <DivergingPanel
        trend={divergingTrend(movementPairs(history), days)}
        subject={MOVEMENT}
      />
    );
  }

  const subject = SUBJECTS[metric];
  const trend = historyTrend(history, metric, unfinishedSince(run));
  return (
    <Frame title={subject.region} legend={<TrendLegend trend={trend} />}>
      <PortfolioTrendChart trend={trend} subject={subject} />
    </Frame>
  );
}

function ActionsPanel({ days }: { days: PortfolioHistoryDays }) {
  const { data: activity } = useSuspenseQuery(actionActivityOptions({ days }));
  return (
    <DivergingPanel
      trend={divergingTrend(actionPairs(activity), days, activeDays(activity))}
      subject={ACTIONS}
    />
  );
}

export function MetricPanel({ metric }: { metric: DashboardMetric }) {
  const range = useDashboardRange();
  const shown = useDeferredValue(metric);
  const { days } = range;
  const waiting = shown !== metric || range.waiting;

  return (
    <div
      aria-busy={waiting || undefined}
      className="border-t border-border px-4 pt-3 pb-4"
    >
      <Suspense fallback={<MetricPanelSkeleton />}>
        {shown === "actions" ? (
          <ActionsPanel days={days} />
        ) : (
          <HistoryPanel metric={shown} days={days} />
        )}
      </Suspense>
    </div>
  );
}
