"use client";

import type { RankDistributionPoint } from "@asobeast/shared";
import { useTranslations } from "next-intl";
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
import { formatDayMonthInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { listingChangeKey, type DayNoter } from "./PortfolioTrendChart";

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
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  if (!active || label === undefined) return null;
  const day = String(label);
  const point = points.find((candidate) => candidate.date === day);
  if (!point) return null;
  return (
    <SeriesTooltip
      title={formatDayMonthInLocale(day, locale)}
      items={[
        {
          key: "top10",
          index: 0,
          color: TOP_TEN_EDGE_PROPS.stroke,
          label: t("charts.top10Label"),
          value: formatNumberInLocale(topTenOf(point), locale),
          sortBy: 0,
        },
        ...PLOTTED_BANDS.map((band, index) => ({
          key: band.key,
          index: 0,
          color: band.color,
          label: band.key === "unranked" ? t("charts.unranked") : band.label,
          value: formatNumberInLocale(point[band.key], locale),
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
  const t = useTranslations("dashboard");
  return (
    <ChartKey
      label={t("charts.rankBands")}
      items={
        points.length === 0
          ? []
          : [
              ...PLOTTED_BANDS.map((band) => ({
                label:
                  band.key === "unranked" ? t("charts.unranked") : band.label,
                color: band.color,
                mark: "square" as const,
              })),
              ...(marked ? [listingChangeKey(t)] : []),
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
  const t = useTranslations("dashboard");
  const state = trendState(points.length);
  if (state !== "ready") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.tall}
        title={
          state === "empty"
            ? t("charts.nothingRecorded")
            : t("charts.notEnoughHistory")
        }
        body={t("charts.rankBandsAppear")}
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
