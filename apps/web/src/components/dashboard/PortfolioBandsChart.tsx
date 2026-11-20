"use client";

import type { RankDistributionPoint } from "@asobeast/shared";
import { ChartKey } from "@/components/charts/ChartKey";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { topTenOf } from "@/components/charts/rank-bands";
import {
  PLOTTED_BANDS,
  RankBandsPlot,
} from "@/components/charts/RankBandsPlot";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import { dayTicks } from "@/components/charts/trend-axis";
import { CHART_HEIGHT, TOP_TEN_EDGE_PROPS } from "@/components/charts/theme";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { LISTING_CHANGE_KEY, type DayNoter } from "./PortfolioTrendChart";

const TOP_TEN_LABEL = "In the top 10";

function BandsTooltip({
  active,
  label,
  points,
  notes,
}: {
  active?: boolean;
  label?: string | number;
  points: RankDistributionPoint[];
  notes: DayNoter;
}) {
  if (!active || label === undefined) return null;
  const day = String(label);
  const point = points.find((candidate) => candidate.date === day);
  if (!point) return null;
  return (
    <SeriesTooltip
      title={formatDayMonth(day)}
      items={[
        {
          key: "top10",
          index: 0,
          color: TOP_TEN_EDGE_PROPS.stroke,
          label: TOP_TEN_LABEL,
          value: formatNumber(topTenOf(point)),
          sortBy: 0,
        },
        ...PLOTTED_BANDS.map((band, index) => ({
          key: band.key,
          index: 0,
          color: band.color,
          label: band.label,
          value: formatNumber(point[band.key]),
          sortBy: index + 1,
        })),
      ]}
      footer={notes(day)}
    />
  );
}

export function BandsLegend({
  points,
  marked,
}: {
  points: RankDistributionPoint[];
  marked: boolean;
}) {
  return (
    <ChartKey
      label="Rank bands"
      items={
        points.length === 0
          ? []
          : [
              ...PLOTTED_BANDS.map((band) => ({
                label: band.label,
                color: band.color,
                mark: "square" as const,
              })),
              ...(marked ? [LISTING_CHANGE_KEY] : []),
            ]
      }
    />
  );
}

export function PortfolioBandsChart({
  points,
  label,
  markers,
  notes,
}: {
  points: RankDistributionPoint[];
  label: string;
  markers: readonly string[];
  notes: DayNoter;
}) {
  const state = trendState(points.length);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.tall}
        title={
          state === "empty" ? "Nothing recorded yet" : "Not enough history yet"
        }
        body="The rank bands appear after a few daily runs."
      />
    );
  }
  return (
    <RankBandsPlot
      points={points}
      label={label}
      ticks={dayTicks(points.map((point) => point.date))}
      markers={markers}
      edge
      tooltip={<BandsTooltip points={points} notes={notes} />}
    />
  );
}
