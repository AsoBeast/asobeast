"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import {
  bandCounts,
  RANK_BANDS,
  UNRANKED_BAND,
} from "@/components/charts/rank-bands";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  COUNT_LINE_PROPS,
  GRID_PROPS,
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatNumber } from "@/lib/format";
import {
  appSummaryOptions,
  rankDistributionHistoryOptions,
} from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";

const BANDS = [...RANK_BANDS, UNRANKED_BAND];

const HEIGHT = CHART_HEIGHT.tall;

const chartConfig = Object.fromEntries(
  BANDS.map((band) => [band.key, { label: band.label, color: band.color }]),
) satisfies ChartConfig;

function BandKey({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const counts = bandCounts(summary.rankDistribution);
  return (
    <ul
      aria-label="Keywords in each rank band today"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      {BANDS.map((band) => (
        <li key={band.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ backgroundColor: band.color }}
          />
          <span>{band.label}</span>
          <span className="numeric font-medium text-foreground">
            {formatNumber(counts[band.key])}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RankBandsChart({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const { country } = useKeywordScope(id);
  const { data } = useSuspenseQuery(
    rankDistributionHistoryOptions(id, presetToRange(range), country),
  );

  const state = trendState(data.points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={HEIGHT}
        title="No rank history yet"
        body="Bands appear once the daily pipeline has checked your keywords."
      />
    );
  }
  if (state === "insufficient") {
    const latest = data.points[data.points.length - 1];
    return (
      <ChartStat
        height={HEIGHT}
        label="Keywords in the top 10"
        value={formatNumber(latest.rank1 + latest.rank2to3 + latest.rank4to10)}
        note="A trend needs a few more daily checks."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BandKey id={id} />
      <ChartContainer
        config={chartConfig}
        className={`${HEIGHT} w-full`}
        role="region"
        aria-label="Tracked keywords by rank band"
      >
        <AreaChart accessibilityLayer data={data.points} margin={CHART_MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...TIME_AXIS_PROPS} />
          <YAxis {...VALUE_AXIS_PROPS} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
          />
          {BANDS.map((band) => (
            <Area
              key={band.key}
              dataKey={band.key}
              type={COUNT_LINE_PROPS.type}
              stackId="bands"
              stroke="var(--card)"
              strokeWidth={1}
              fill={`var(--color-${band.key})`}
              fillOpacity={1}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
