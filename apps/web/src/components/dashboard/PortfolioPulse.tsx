"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionSummary } from "@asobeast/shared";
import { TrendChip } from "@/components/ui/delta-chip";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatNumber } from "@/lib/format";
import {
  actionSummaryOptions,
  portfolioInsightsOptions,
  portfolioOptions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { MovementValue } from "./MovementValue";
import { PULSE_GRID } from "./skeletons";

function Top10Note({
  delta,
  tracked,
}: {
  delta: number | null;
  tracked: number;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-1">
      <TrendChip label="7d" value={delta} />
      <span>of {formatNumber(tracked)} tracked</span>
    </span>
  );
}

function OpenActionsNote({ summary }: { summary: ActionSummary }) {
  if (summary.generatedAt === null) return "not generated yet";
  const { critical, high } = summary.openByPriority;
  if (critical === 0 && high === 0) return "waiting on you";
  return (
    <>
      <span className={cn(critical > 0 && "text-priority-critical")}>
        {formatNumber(critical)} critical
      </span>{" "}
      · {formatNumber(high)} high
    </>
  );
}

export function PortfolioPulse() {
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: actions } = useSuspenseQuery(actionSummaryOptions);
  if (portfolio.apps.length === 0) return null;

  const { top10, top10Delta7d, movement, changes7d } = insights.totals;

  return (
    <StatTileGroup className={PULSE_GRID}>
      <StatTile
        label="Keywords in top 10"
        value={formatNumber(top10)}
        note={
          <Top10Note
            delta={top10Delta7d}
            tracked={portfolio.totals.trackedKeywords}
          />
        }
      />
      <StatTile
        label="Keyword movement"
        value={<MovementValue movement={movement} />}
        note={`${formatNumber(movement.entered)} new · ${formatNumber(movement.lost)} lost in 7 days`}
      />
      <StatTile
        label="Open actions"
        value={actions.generatedAt === null ? "—" : formatNumber(actions.open)}
        note={<OpenActionsNote summary={actions} />}
      />
      <StatTile
        label="Changes this week"
        value={formatNumber(changes7d.own + changes7d.competitors)}
        note={`${formatNumber(changes7d.competitors)} by competitors · ${formatNumber(changes7d.own)} yours`}
      />
    </StatTileGroup>
  );
}
