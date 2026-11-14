"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartKey, type ChartKeyItem } from "@/components/charts/ChartKey";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { SeriesFade, useFadeId } from "@/components/charts/SeriesFade";
import {
  CHANGE_MARKER_PROPS,
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  PENDING_LINE_PROPS,
  SCORE_AXIS_PROPS,
  seriesColor,
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
import { formatDate } from "@/lib/format";
import { auditHistoryOptions } from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";
import { rubricChanges } from "./rubric-changes";
import { scoredPoints } from "./score-history";

const HEIGHT = CHART_HEIGHT.tall;
const SERIES = seriesColor(0);
const REACHABLE = "var(--muted-foreground)";

const chartConfig = {
  overall: { label: "ASO score", color: SERIES },
} satisfies ChartConfig;

function keyItems(
  potential: number | null,
  hasRubricChange: boolean,
): ChartKeyItem[] {
  return [
    { label: "ASO score", color: SERIES, mark: "line" },
    ...(potential === null
      ? []
      : [
          {
            label: `Reachable ${Math.round(potential)}`,
            color: REACHABLE,
            mark: "dash" as const,
          },
        ]),
    ...(hasRubricChange
      ? [
          {
            label: "Rubric change",
            color: CHANGE_MARKER_PROPS.stroke,
            mark: "dash" as const,
          },
        ]
      : []),
  ];
}

export function AuditHealthChart({
  id,
  range,
  potential,
}: {
  id: string;
  range: VisibilityRange;
  potential: number | null;
}) {
  const fadeId = useFadeId();
  const { data } = useSuspenseQuery(
    auditHistoryOptions(id, presetToRange(range)),
  );
  const points = scoredPoints(data.points);
  const state = trendState(points.length);

  if (state === "empty") {
    return (
      <ChartNotice
        height={HEIGHT}
        title="No audit snapshots yet"
        body="The daily audit snapshot builds this trend."
      />
    );
  }
  if (state === "insufficient") {
    const last = points[points.length - 1];
    return (
      <ChartStat
        height={HEIGHT}
        label={`Last daily snapshot · ${formatDate(last.date)}`}
        value={String(last.overall)}
        note="A trend needs a few more daily snapshots."
      />
    );
  }

  const changes = rubricChanges(data.points);

  return (
    <div className="flex flex-col gap-2">
      <ChartKey
        label="Score history key"
        items={keyItems(potential, changes.length > 0)}
      />
      <ChartContainer
        config={chartConfig}
        className={`${HEIGHT} w-full`}
        role="region"
        aria-label="Score history"
      >
        <ComposedChart
          accessibilityLayer
          data={data.points}
          margin={CHART_MARGIN}
        >
          <SeriesFade id={fadeId} color={SERIES} />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...TIME_AXIS_PROPS} />
          <YAxis {...VALUE_AXIS_PROPS} {...SCORE_AXIS_PROPS} />
          <ChartTooltip
            content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
          />
          {changes.map((change) => (
            <ReferenceLine
              key={`${change.date}-${change.version}`}
              x={change.date}
              {...CHANGE_MARKER_PROPS}
              label={{
                value: `Rubric ${change.version}`,
                position:
                  change.labelPosition === "insideRight"
                    ? "insideTopRight"
                    : "insideTopLeft",
              }}
            />
          ))}
          {potential === null ? null : (
            <ReferenceLine
              y={potential}
              stroke={REACHABLE}
              strokeWidth={1.5}
              strokeDasharray={PENDING_LINE_PROPS.strokeDasharray}
            />
          )}
          <Area
            {...LINE_PROPS}
            dataKey="overall"
            stroke="var(--color-overall)"
            fill={`url(#${fadeId})`}
            connectNulls={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
