"use client";

import { useMemo, type Ref } from "react";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  SCORE_AXIS_PROPS,
} from "@/components/charts/theme";
import { ChartContainer } from "@/components/ui/chart";
import type { KeywordZone, ZoneThresholds } from "@/lib/keyword-zones";
import { labelledIds, type MapPoint } from "./map-points";
import { MapDotShape, MapDotState } from "./MapDot";
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
  const dotState = useMemo(
    () => ({ chosenZone: zone, labelled: labelledIds(points, zone) }),
    [points, zone],
  );
  const data = useMemo(() => [...points], [points]);
  return (
    <MapDotState.Provider value={dotState}>
      <ChartContainer
        ref={chartRef}
        config={{}}
        role="region"
        aria-label="Keyword opportunity map"
        className={`${CHART_HEIGHT.hero} w-full`}
      >
        <ScatterChart
          accessibilityLayer
          role="group"
          tabIndex={-1}
          aria-label="Keywords by difficulty and popularity"
          aria-describedby={describedBy}
          margin={CHART_MARGIN}
        >
          {zoneAreas({ thresholds, selected: zone, onZone })}
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            {...SCORE_AXIS_PROPS}
            dataKey="difficulty"
            name="Difficulty"
            height={44}
            label={{
              value: "Difficulty",
              position: "insideBottom",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          <YAxis
            {...SCORE_AXIS_PROPS}
            dataKey="popularity"
            name="Popularity"
            width={48}
            label={{
              value: "Popularity",
              angle: -90,
              position: "insideLeft",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          {thresholdLines(thresholds)}
          <Scatter data={data} shape={MapDotShape} isAnimationActive={false} />
        </ScatterChart>
      </ChartContainer>
    </MapDotState.Provider>
  );
}
