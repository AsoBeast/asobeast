"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { bandCounts, topTenOf } from "@/components/charts/rank-bands";
import {
  PLOTTED_BANDS,
  RankBandsPlot,
} from "@/components/charts/RankBandsPlot";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { formatNumber } from "@/lib/format";
import {
  appSummaryOptions,
  rankDistributionHistoryOptions,
} from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";

const HEIGHT = CHART_HEIGHT.tall;

function BandKey({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const counts = bandCounts(summary.rankDistribution);
  return (
    <ul
      aria-label="Keywords in each rank band today"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-muted-foreground"
    >
      {PLOTTED_BANDS.map((band) => (
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
        value={formatNumber(topTenOf(latest))}
        note="A trend needs a few more daily checks."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BandKey id={id} />
      <RankBandsPlot
        points={data.points}
        label="Tracked keywords by rank band"
      />
    </div>
  );
}
