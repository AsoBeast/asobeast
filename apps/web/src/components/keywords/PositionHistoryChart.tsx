"use client";

import type { Ref } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCheckedPosition,
  RANK_DEPTH,
  type ChangeField,
} from "@asobeast/shared";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import {
  markerLineProps,
  RANK_TICKS,
  rankTierAreas,
} from "@/components/charts/rank-layers";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  RANK_AXIS_PROPS,
  TIME_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  lastCheckedIndex,
  loneKey,
  NOT_CHECKED,
  notFoundKey,
  type RankingChartData,
} from "@/components/rankings/pivot";
import { formatDayMonth } from "@/lib/format";
import {
  changedFieldsLabel,
  changeSincePrevious,
  movementLine,
} from "./position-history";

function HistoryTooltip({
  active,
  label,
  data,
  changes,
}: {
  active?: boolean;
  label?: string | number;
  data: RankingChartData;
  changes: Map<string, ChangeField[]>;
}) {
  if (!active || label === undefined) return null;
  const day = String(label);
  const index = data.rows.findIndex((row) => row.date === day);
  const keywordId = data.keywordIds[0];
  if (index < 0 || keywordId === undefined) return null;

  const value = data.rows[index]?.[keywordId];
  const depth = data.depths[index]?.[keywordId] ?? null;
  const movement = changeSincePrevious(data, index);
  const changed = changes.get(day);

  return (
    <SeriesTooltip
      title={formatDayMonth(day)}
      items={[
        {
          key: keywordId,
          index: 0,
          color: data.config[keywordId]?.color,
          label: "Position",
          value:
            formatCheckedPosition(
              typeof value === "number" ? value : null,
              depth,
            ) ?? NOT_CHECKED,
          sortBy: 0,
        },
      ]}
      footer={
        movement || changed ? (
          <div className="grid gap-0.5 text-muted-foreground">
            {movement ? (
              <span>{movementLine(movement.places, movement.day)}</span>
            ) : null}
            {changed ? (
              <span>{changedFieldsLabel(changed)} changed</span>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}

export function PositionHistoryChart({
  data,
  line,
  best,
  changes,
  label,
  busy,
  chartRef,
}: {
  data: RankingChartData;
  line: boolean;
  best: number | null;
  changes: Map<string, ChangeField[]>;
  label: string;
  busy: boolean;
  chartRef?: Ref<HTMLDivElement>;
}) {
  const fadeId = useFadeId();
  const keywordId = data.keywordIds[0] ?? "";
  const color = `var(--color-${keywordId})`;
  const latest = data.rows[lastCheckedIndex(data)];
  const latestPosition = latest?.[keywordId];
  const ranked = data.rows.some((row) => typeof row[keywordId] === "number");

  return (
    <ChartContainer
      ref={chartRef}
      config={data.config}
      className={`${CHART_HEIGHT.compact} w-full`}
      role="region"
      aria-label={label}
      aria-busy={busy || undefined}
    >
      <ComposedChart accessibilityLayer data={data.rows} margin={CHART_MARGIN}>
        <SeriesFade id={fadeId} color={color} />
        {rankTierAreas()}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis
          {...RANK_AXIS_PROPS}
          domain={[1, RANK_DEPTH]}
          ticks={RANK_TICKS}
        />
        {[...changes.keys()].map((day) => (
          <ReferenceLine key={day} x={day} {...CHANGE_MARKER_PROPS} />
        ))}
        {best !== null && ranked ? (
          <ReferenceLine
            y={best}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            label={{
              value: `Best ${best}`,
              position: "insideBottomLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
        ) : null}
        <ChartTooltip
          filterNull={false}
          content={<HistoryTooltip data={data} changes={changes} />}
        />
        {line ? (
          <Area
            dataKey={keywordId}
            type={LINE_PROPS.type}
            baseValue={RANK_DEPTH}
            fill={`url(#${fadeId})`}
            stroke="none"
            connectNulls={false}
            activeDot={false}
            legendType="none"
          />
        ) : null}
        {line ? (
          <Line
            {...LINE_PROPS}
            dataKey={keywordId}
            stroke={color}
            connectNulls={false}
          />
        ) : (
          <Line {...markerLineProps(keywordId, keywordId, color)} />
        )}
        <Line
          {...markerLineProps(
            notFoundKey(keywordId),
            keywordId,
            "var(--background)",
          )}
        />
        {line ? (
          <Line {...markerLineProps(loneKey(keywordId), keywordId, color)} />
        ) : null}
        {typeof latestPosition === "number" ? (
          <ReferenceDot
            x={String(latest?.date)}
            y={latestPosition}
            r={5}
            fill={color}
            stroke="var(--background)"
            strokeWidth={2}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
