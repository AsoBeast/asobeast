"use client";

import { Suspense, useDeferredValue, type ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import type { MessageTranslator } from "@/i18n/translator";
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

const visibilitySubject = (t: MessageTranslator): TrendSubject => ({
  label: t("charts.visibilityLabel"),
  region: t("charts.visibilityRegion"),
  counted: false,
});

const topTenSubject = (t: MessageTranslator): TrendSubject => ({
  label: t("charts.top10Label"),
  region: t("charts.top10Region"),
  counted: true,
});

const movementSubject = (t: MessageTranslator): DivergingSubject => ({
  region: t("charts.movementRegion"),
  waiting: t("charts.movementWaiting"),
  up: { label: t("charts.climbed"), color: MOVEMENT_COLORS.climbed },
  down: { label: t("charts.fell"), color: MOVEMENT_COLORS.fell },
});

const actionsSubject = (t: MessageTranslator): DivergingSubject => ({
  region: t("charts.actionsRegion"),
  waiting: t("charts.actionsWaiting"),
  up: { label: t("charts.opened"), color: ACTION_COLORS.opened },
  down: { label: t("charts.closed"), color: ACTION_COLORS.closed },
});

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

const actionPairs = (activity: ActionActivity): DailyPair[] =>
  activityRows(activity).map((row) => ({
    date: row.date,
    up: row.opened,
    down: row.closedByYou + row.resolved,
  }));

const scopedTitle = (
  t: MessageTranslator,
  region: string,
  name: string | null,
): string =>
  name === null
    ? t("charts.seriesTitleAll", { region })
    : t("charts.seriesTitleScope", { region, name });

const scopedRegion = (
  t: MessageTranslator,
  region: string,
  name: string | null,
  days: number,
): string =>
  name === null
    ? t("charts.seriesRegionAll", { region, days })
    : t("charts.seriesRegionScope", { region, name, days });

function useScopeName(scope: PortfolioHistoryScope): string | null {
  const t = useTranslations("dashboard");
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  if (scope.store) return storeLabel(scope.store);
  const app = portfolio.apps.find((each) => each.id === scope.appId);
  return app ? appLabel(app, portfolio.apps, t) : null;
}

function ScopeChip({ scope }: { scope: PortfolioHistoryScope }) {
  const t = useTranslations("dashboard");
  const [, setBreakdown] = useQueryStates(dashboardBreakdownParsers);
  const name = useScopeName(scope);
  const id = scopeId(scope);
  if (name === null || id === null) return null;
  return (
    <Button
      variant="outline"
      size="xs"
      aria-label={t("charts.showEveryApp", { name })}
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
  const t = useTranslations("dashboard");
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
  const chip = <ScopeChip scope={scope} />;

  if (metric === "moved") {
    return (
      <DivergingPanel
        trend={divergingTrend(movementPairs(history), days)}
        subject={movementSubject(t)}
        scope={scope}
        note={t("charts.movementNote")}
        notes={noted("moved")}
      />
    );
  }

  if (metric === "top10" && history.bands) {
    const markers = markedDays(history, history.bands);
    const rankLabel = t("charts.rankLabel");
    return (
      <Frame
        title={scopedTitle(t, rankLabel, named)}
        scoped={chip}
        legend={
          <BandsLegend points={history.bands} marked={markers.length > 0} />
        }
      >
        <PortfolioBandsChart
          points={history.bands}
          label={scopedRegion(t, rankLabel, named, days)}
          markers={markers}
          notes={noted("top10")}
        />
      </Frame>
    );
  }

  const subject = metric === "top10" ? topTenSubject(t) : visibilitySubject(t);
  const trend = historyTrend(history, metric, unfinishedSince(run));
  const shown = markedDays(history, trend.rows);
  return (
    <Frame
      title={scopedTitle(t, subject.region, named)}
      scoped={chip}
      legend={<TrendLegend trend={trend} marked={shown.length > 0} />}
    >
      <PortfolioTrendChart
        trend={trend}
        subject={{
          ...subject,
          region: scopedRegion(t, subject.region, named, days),
        }}
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
  const t = useTranslations("dashboard");
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions({ days, ...scope }),
  );
  return (
    <DivergingPanel
      trend={divergingTrend(actionPairs(activity), days, activeDays(activity))}
      subject={actionsSubject(t)}
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
