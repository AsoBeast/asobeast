"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionSummary, PortfolioMovement } from "@asobeast/shared";
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
import { ChartLegend, VisibilityByAppChart } from "./VisibilityByAppChart";
import { PULSE_STRIP } from "./skeletons";
import { portfolioVisibility } from "./visibility-series";

function Figure({ value, children }: { value: string; children?: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{value}</span>
      {children}
    </span>
  );
}

function MovedValue({ movement }: { movement: PortfolioMovement }) {
  return (
    <Figure value={formatNumber(movement.up + movement.down)}>
      {movement.up > 0 ? (
        <Badge variant="up">
          <span aria-hidden>{`▲ ${formatNumber(movement.up)}`}</span>
          <span className="sr-only">{`${movement.up} climbed`}</span>
        </Badge>
      ) : null}
      {movement.down > 0 ? (
        <Badge variant="down">
          <span aria-hidden>{`▼ ${formatNumber(movement.down)}`}</span>
          <span className="sr-only">{`${movement.down} fell`}</span>
        </Badge>
      ) : null}
    </Figure>
  );
}

function movedNote({ entered, lost }: PortfolioMovement): string {
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

export function PortfolioPulse() {
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: actions } = useSuspenseQuery(actionSummaryOptions);
  if (portfolio.apps.length === 0) return null;

  const { top10, top10Delta7d, movement, changes7d } = insights.totals;
  const charted = portfolioVisibility(portfolio.apps);

  return (
    <Card className="gap-0 py-0">
      <StatTileGroup className={PULSE_STRIP}>
        <StatTile
          label="Keywords in top 10"
          value={
            <Figure value={formatNumber(top10)}>
              <TrendChip label="7d" value={top10Delta7d} form="pill" />
            </Figure>
          }
          note={`of ${formatNumber(portfolio.totals.trackedKeywords)} tracked`}
        />
        <StatTile
          label="Moved in 7 days"
          value={<MovedValue movement={movement} />}
          note={movedNote(movement)}
        />
        <StatTile
          label="Open actions"
          value={<ActionsValue summary={actions} />}
          note={actionsNote(actions)}
        />
        <StatTile
          label="Listing changes in 7 days"
          value={
            <Figure
              value={formatNumber(changes7d.own + changes7d.competitors)}
            />
          }
          note={`${formatNumber(changes7d.own)} by you · ${formatNumber(changes7d.competitors)} by competitors`}
        />
      </StatTileGroup>
      <section
        aria-labelledby="visibility-heading"
        className="flex flex-col gap-3 border-t border-border px-4 pt-3 pb-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="visibility-heading" className="text-heading">
            Visibility by app
          </h2>
          <ChartLegend series={charted.series} />
        </div>
        <VisibilityByAppChart apps={portfolio.apps} />
        <p className="text-caption text-faint-foreground">
          {charted.omitted > 0
            ? `Last 30 days · the ${pluralize(charted.series.length, "most visible app")} · ${pluralize(charted.omitted, "more app")} in the table below`
            : "Last 30 days"}
        </p>
      </section>
    </Card>
  );
}
