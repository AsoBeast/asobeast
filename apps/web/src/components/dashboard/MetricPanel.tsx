"use client";

import { Suspense, useDeferredValue, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { X } from "lucide-react";
import type {
  ActionActivity,
  PortfolioHistoryDays,
  PortfolioHistoryScope,
} from "@asobeast/shared";
import { activeDays, activityRows } from "@/components/actions/activity-chart";
import { ACTION_COLORS, MOVEMENT_COLORS } from "@/components/charts/theme";
import { Button } from "@/components/ui/button";
import { storeLabel } from "@/lib/format";
import {
  actionActivityOptions,
  portfolioHistoryOptions,
  portfolioOptions,
  runStatusOptions,
} from "@/lib/queries";
import {
  dashboardBreakdownParsers,
  type DashboardMetric,
} from "@/lib/search-params";
import {
  DivergingBars,
  DivergingKey,
  type DivergingNotes,
  type DivergingSubject,
} from "@/components/charts/DivergingBars";
import {
  type DailyPair,
  type DivergingTrend,
  divergingTrend,
} from "@/components/charts/diverging-trend";
import { appLabel, scopeId } from "./breakdown";
import { DayNotes, markedDays, type NotedMetric } from "./DayNotes";
import { historyTrend, movementPairs, unfinishedSince } from "./history-trend";
import { BandsLegend, PortfolioBandsChart } from "./PortfolioBandsChart";
import {
  PortfolioTrendChart,
  TrendLegend,
  type DayNoter,
  type TrendSubject,
} from "./PortfolioTrendChart";
import { focusScopeSurvivor } from "./scope-focus";
import { MetricPanelSkeleton } from "./skeletons";
import { useDashboardRange, useDashboardScope } from "./use-range-history";

type HistoryMetric = Exclude<DashboardMetric, "actions">;

const VISIBILITY: TrendSubject = {
  label: "Visibility",
  region: "Visibility",
  counted: false,
};

const TOP_TEN: TrendSubject = {
  label: "In the top 10",
  region: "Keywords in the top 10",
  counted: true,
};

const EVERY_APP = " across your apps";

const MOVEMENT_NOTE =
  "A keyword that moves on several days counts on each. The tile compares the first and the last day.";

function Frame({
  title,
  scoped,
  legend,
  note,
  children,
}: {
  title: string;
  scoped: ReactNode;
  legend?: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-label font-medium text-muted-foreground">
            {title}
          </p>
          {scoped}
        </div>
        {legend}
      </div>
      {children}
      {note ? (
        <p className="text-caption text-faint-foreground">{note}</p>
      ) : null}
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

function useScopeName(scope: PortfolioHistoryScope): string | null {
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  if (scope.store) return storeLabel(scope.store);
  const app = portfolio.apps.find((each) => each.id === scope.appId);
  return app ? appLabel(app, portfolio.apps) : null;
}

function ScopeChip({ scope }: { scope: PortfolioHistoryScope }) {
  const [, setBreakdown] = useQueryStates(dashboardBreakdownParsers);
  const name = useScopeName(scope);
  const id = scopeId(scope);
  if (name === null || id === null) return null;
  return (
    <Button
      variant="outline"
      size="xs"
      aria-label={`${name}, show every app`}
      onClick={() => {
        focusScopeSurvivor(id);
        void setBreakdown({ scope: null });
      }}
    >
      <span>{name}</span>
      <X aria-hidden data-icon="inline-end" />
    </Button>
  );
}

function DivergingPanel({
  trend,
  subject,
  scope,
  note,
  notes,
}: {
  trend: DivergingTrend;
  subject: DivergingSubject;
  scope: PortfolioHistoryScope;
  note?: string;
  notes?: DivergingNotes;
}) {
  return (
    <Frame
      title={subject.region}
      scoped={<ScopeChip scope={scope} />}
      legend={<DivergingKey trend={trend} subject={subject} />}
      note={note}
    >
      <DivergingBars trend={trend} subject={subject} notes={notes} />
    </Frame>
  );
}

function HistoryPanel({
  metric,
  days,
  scope,
}: {
  metric: HistoryMetric;
  days: PortfolioHistoryDays;
  scope: PortfolioHistoryScope;
}) {
  const { data: history } = useSuspenseQuery(
    portfolioHistoryOptions(days, scope),
  );
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: run } = useSuspenseQuery(runStatusOptions);
  const noted = (shown: NotedMetric): DayNoter =>
    function notesOf(date) {
      return (
        <DayNotes
          history={history}
          apps={portfolio.apps}
          metric={shown}
          date={date}
        />
      );
    };
  const named = useScopeName(scope);
  const everywhere = named === null ? EVERY_APP : "";
  const reach = named === null ? EVERY_APP : ` of ${named}`;
  const chip = <ScopeChip scope={scope} />;

  if (metric === "moved") {
    return (
      <DivergingPanel
        trend={divergingTrend(movementPairs(history), days)}
        subject={MOVEMENT}
        scope={scope}
        note={MOVEMENT_NOTE}
        notes={noted("moved")}
      />
    );
  }

  if (metric === "top10" && history.bands) {
    const markers = markedDays(history, history.bands);
    return (
      <Frame
        title={`Keywords by rank${everywhere}`}
        scoped={chip}
        legend={
          <BandsLegend points={history.bands} marked={markers.length > 0} />
        }
      >
        <PortfolioBandsChart
          points={history.bands}
          label={`Keywords by rank${reach} over the last ${days} days`}
          markers={markers}
          notes={noted("top10")}
        />
      </Frame>
    );
  }

  const subject = metric === "top10" ? TOP_TEN : VISIBILITY;
  const trend = historyTrend(history, metric, unfinishedSince(run));
  const shown = markedDays(history, trend.rows);
  return (
    <Frame
      title={`${subject.region}${everywhere}`}
      scoped={chip}
      legend={<TrendLegend trend={trend} marked={shown.length > 0} />}
    >
      <PortfolioTrendChart
        trend={trend}
        subject={{ ...subject, region: `${subject.region}${reach}` }}
        markers={shown}
        notes={noted(metric)}
      />
    </Frame>
  );
}

function ActionsPanel({
  days,
  scope,
}: {
  days: PortfolioHistoryDays;
  scope: PortfolioHistoryScope;
}) {
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions({ days, ...scope }),
  );
  return (
    <DivergingPanel
      trend={divergingTrend(actionPairs(activity), days, activeDays(activity))}
      subject={ACTIONS}
      scope={scope}
    />
  );
}

export function MetricPanel({ metric }: { metric: DashboardMetric }) {
  const range = useDashboardRange();
  const scoped = useDashboardScope();
  const shown = useDeferredValue(metric);
  const { days } = range;
  const waiting = shown !== metric || range.waiting || scoped.waiting;

  return (
    <div
      aria-busy={waiting || undefined}
      className="relative z-1 min-w-0 px-4 pt-3 pb-4"
    >
      <Suspense fallback={<MetricPanelSkeleton />}>
        {shown === "actions" ? (
          <ActionsPanel days={days} scope={scoped.scope} />
        ) : (
          <HistoryPanel metric={shown} days={days} scope={scoped.scope} />
        )}
      </Suspense>
    </div>
  );
}
