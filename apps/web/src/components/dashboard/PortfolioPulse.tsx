"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type {
  ActionSummary,
  PortfolioApp,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DirectionArrow, TrendChip } from "@/components/ui/delta-chip";
import { MetricStrip, StatTile } from "@/components/ui/stat-tile";
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

function movedValue(change: PortfolioRangeChange): string {
  if (!change.compared) return "—";
  const { up, down } = change.movement;
  return formatNumber(up + down);
}

function MovedDelta({ change }: { change: PortfolioRangeChange }) {
  if (!change.compared) return null;
  const { up, down } = change.movement;
  return (
    <>
      {up > 0 ? (
        <Badge variant="up">
          <DirectionArrow way="up" />
          <span aria-hidden>{formatNumber(up)}</span>
          <span className="sr-only">{`${formatNumber(up)} climbed`}</span>
        </Badge>
      ) : null}
      {down > 0 ? (
        <Badge variant="down">
          <DirectionArrow way="down" />
          <span aria-hidden>{formatNumber(down)}</span>
          <span className="sr-only">{`${formatNumber(down)} fell`}</span>
        </Badge>
      ) : null}
    </>
  );
}

const rangeUnit = (days: number): string => `${days}d`;

function movedNote(change: PortfolioRangeChange, days: number): string {
  if (!change.compared) return `No check from ${days} days ago yet`;
  const { entered, lost } = change.movement;
  return `${formatNumber(entered)} started ranking · ${formatNumber(lost)} dropped out`;
}

const actionsValue = (summary: ActionSummary): string =>
  summary.generatedAt === null ? "—" : formatNumber(summary.open);

function ActionsDelta({ summary }: { summary: ActionSummary }) {
  const { critical } = summary.openByPriority;
  if (summary.generatedAt === null || critical === 0) return null;
  return <Badge variant="down">{`${formatNumber(critical)} critical`}</Badge>;
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
      <MetricStrip columns={4} framed={false}>
        {visibility ? (
          <StatTile
            {...tab("visibility")}
            label="Visibility"
            value={formatNumber(Math.round(visibility.current))}
            delta={
              <TrendChip label={unit} value={visibilityDelta} form="pill" />
            }
            note={visibilityNote(portfolio.apps)}
          />
        ) : null}
        <StatTile
          {...tab("top10")}
          label="Keywords in top 10"
          value={formatNumber(top10)}
          delta={<TrendChip label={unit} value={top10Delta} form="pill" />}
          note={`of ${formatNumber(portfolio.totals.trackedKeywords)} tracked`}
        />
        <StatTile
          {...tab("moved")}
          label={`Moved in ${days} days`}
          value={movedValue(history.change)}
          delta={<MovedDelta change={history.change} />}
          note={movedNote(history.change, days)}
        />
        <StatTile
          {...tab("actions")}
          label="Open actions"
          value={actionsValue(actions)}
          delta={<ActionsDelta summary={actions} />}
          note={actionsNote(actions)}
        />
      </MetricStrip>
      <MetricPanel metric={shown} />
    </Card>
  );
}
