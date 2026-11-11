"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type {
  ActionSummary,
  PortfolioApp,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatNumber, pluralize } from "@/lib/format";
import {
  actionSummaryOptions,
  portfolioInsightsOptions,
  portfolioOptions,
} from "@/lib/queries";
import { MetricPanel } from "./MetricPanel";
import { useRangeHistory } from "./use-range-history";
import { useRefreshAfterRun } from "./use-refresh-after-run";
import {
  dashboardMetricParser,
  type DashboardMetric,
} from "@/lib/search-params";
import { PULSE_STRIP } from "./layout-classes";

function Figure({ value, children }: { value: string; children?: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{value}</span>
      {children}
    </span>
  );
}

function MovedValue({ change }: { change: PortfolioRangeChange }) {
  if (!change.compared) return <Figure value="—" />;
  const { up, down } = change.movement;
  return (
    <Figure value={formatNumber(up + down)}>
      {up > 0 ? (
        <Badge variant="up">
          <span aria-hidden>{`▲ ${formatNumber(up)}`}</span>
          <span className="sr-only">{`${formatNumber(up)} climbed`}</span>
        </Badge>
      ) : null}
      {down > 0 ? (
        <Badge variant="down">
          <span aria-hidden>{`▼ ${formatNumber(down)}`}</span>
          <span className="sr-only">{`${formatNumber(down)} fell`}</span>
        </Badge>
      ) : null}
    </Figure>
  );
}

const rangeUnit = (days: number): string => `${days}d`;

function movedNote(change: PortfolioRangeChange, days: number): string {
  if (!change.compared) return `No check from ${days} days ago yet`;
  const { entered, lost } = change.movement;
  return `${formatNumber(entered)} started ranking · ${formatNumber(lost)} dropped out`;
}

function ActionsValue({ summary }: { summary: ActionSummary }) {
  if (summary.generatedAt === null) return <Figure value="—" />;
  const { critical } = summary.openByPriority;
  return (
    <Figure value={formatNumber(summary.open)}>
      {critical > 0 ? (
        <Badge variant="down">{`${formatNumber(critical)} critical`}</Badge>
      ) : null}
    </Figure>
  );
}

function actionsNote(summary: ActionSummary): string {
  if (summary.generatedAt === null) return "Not generated yet";
  const { high, medium, low } = summary.openByPriority;
  if (summary.open === 0) return "Nothing waiting on you";
  return `${formatNumber(high)} high · ${formatNumber(medium)} medium · ${formatNumber(low)} low`;
}

function visibilityNote(apps: PortfolioApp[]): string {
  const checked = apps.filter((app) => app.lastCapturedAt !== null).length;
  return `across ${pluralize(checked, "app")}`;
}

export function PortfolioPulse() {
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: actions } = useSuspenseQuery(actionSummaryOptions);
  const [metric, setMetric] = useQueryState("metric", dashboardMetricParser);
  const { days, history } = useRangeHistory();
  useRefreshAfterRun();
  if (portfolio.apps.length === 0) return null;

  const { top10 } = insights.totals;
  const { visibilityDelta, top10Delta } = history.change;
  const unit = rangeUnit(days);
  const { visibility } = portfolio;
  const shown: DashboardMetric =
    metric === "visibility" && !visibility ? "top10" : metric;
  const tab = (value: DashboardMetric) => ({
    selected: shown === value,
    onSelect: () => void setMetric(value),
  });

  return (
    <Card className="gap-0 py-0">
      <StatTileGroup className={PULSE_STRIP}>
        {visibility ? (
          <StatTile
            {...tab("visibility")}
            label="Visibility"
            value={
              <Figure value={formatNumber(Math.round(visibility.current))}>
                <TrendChip label={unit} value={visibilityDelta} form="pill" />
              </Figure>
            }
            note={visibilityNote(portfolio.apps)}
          />
        ) : null}
        <StatTile
          {...tab("top10")}
          label="Keywords in top 10"
          value={
            <Figure value={formatNumber(top10)}>
              <TrendChip label={unit} value={top10Delta} form="pill" />
            </Figure>
          }
          note={`of ${formatNumber(portfolio.totals.trackedKeywords)} tracked`}
        />
        <StatTile
          {...tab("moved")}
          label={`Moved in ${days} days`}
          value={<MovedValue change={history.change} />}
          note={movedNote(history.change, days)}
        />
        <StatTile
          {...tab("actions")}
          label="Open actions"
          value={<ActionsValue summary={actions} />}
          note={actionsNote(actions)}
        />
      </StatTileGroup>
      <MetricPanel metric={shown} />
    </Card>
  );
}
