"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  SCORE_AXIS_PROPS,
} from "@/components/charts/theme";
import { ChartContainer } from "@/components/ui/chart";
import type { KeywordZone, ZoneThresholds } from "@/lib/keyword-zones";
import type { MapPoint } from "./map-points";
import { MapDotShape } from "./MapDot";
import { thresholdLines, zoneAreas } from "./zone-layers";

export function KeywordMapChart({
  points,
  thresholds,
  zone,
  describedBy,
  onZone,
  chartRef,
}: {
  points: readonly MapPoint[];
  thresholds: ZoneThresholds;
  zone: KeywordZone | null;
  describedBy: string;
  onZone: (zone: KeywordZone) => void;
  chartRef?: Ref<HTMLDivElement>;
}) {
  const t = useTranslations("keywordInspector");
  return (
    <ChartContainer
      ref={chartRef}
      config={{}}
      role="region"
      aria-label={t("map.chart.aria")}
      className={`${CHART_HEIGHT.hero} w-full`}
    >
      <ScatterChart
        accessibilityLayer
        role="group"
        tabIndex={-1}
        aria-label={t("map.chart.group")}
        aria-describedby={describedBy}
        margin={CHART_MARGIN}
      >
        {zoneAreas({ thresholds, selected: zone, onZone, t })}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          {...SCORE_AXIS_PROPS}
          dataKey="difficulty"
          name={t("map.chart.difficulty")}
          height={44}
          label={{
            value: t("map.chart.difficulty"),
            position: "insideBottom",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <YAxis
          {...SCORE_AXIS_PROPS}
          dataKey="popularity"
          name={t("map.chart.popularity")}
          width={48}
          label={{
            value: t("map.chart.popularity"),
            angle: -90,
            position: "insideLeft",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        {thresholdLines(thresholds, t)}
        <Scatter data={points} shape={MapDotShape} isAnimationActive={false} />
      </ScatterChart>
    </ChartContainer>
  );
}
