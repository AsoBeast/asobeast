"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { AuditScorePoint } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  TIME_AXIS_PROPS,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { formatDate } from "@/lib/format";
import { auditHistoryOptions } from "@/lib/queries";

const chartConfig = {
  overall: { label: "ASO score", color: seriesColor(0) },
} satisfies ChartConfig;

const DELTA_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function scored(points: AuditScorePoint[]): AuditScorePoint[] {
  return points.filter((point) => point.overall !== null);
}

function computeDelta(points: AuditScorePoint[]): number | null {
  const withScore = scored(points);
  if (withScore.length === 0) return null;
  const current = withScore[withScore.length - 1];
  const target = new Date(current.date).getTime() - DELTA_WINDOW_DAYS * DAY_MS;
  const baseline = [...withScore]
    .reverse()
    .find((point) => new Date(point.date).getTime() <= target);
  if (!baseline || baseline === current) return null;
  return (current.overall as number) - (baseline.overall as number);
}

const RUBRIC_V2 = "v2";

function rubricChangeDate(points: AuditScorePoint[]): string | null {
  const versions = new Set(
    points.map((point) => point.rubricVersion).filter(Boolean),
  );
  if (versions.size < 2) return null;
  return (
    points.find((point) => point.rubricVersion === RUBRIC_V2)?.date ?? null
  );
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const rounded = Math.round(delta);
  const variant =
    rounded > 0 ? "success" : rounded < 0 ? "destructive" : "secondary";
  const sign = rounded > 0 ? "+" : "";
  return (
    <Badge variant={variant}>
      {sign}
      {rounded} vs 7d
    </Badge>
  );
}

export function AuditHealthChart({ id }: { id: string }) {
  const { data } = useSuspenseQuery(auditHistoryOptions(id));
  const points = scored(data.points);
  const state = trendState(points.length);
  const rubricChange = rubricChangeDate(data.points);
  const lastPoint = points[points.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardDescription>ASO health</CardDescription>
        <CardTitle asChild>
          <h2>Score history</h2>
        </CardTitle>
        <CardAction>
          <DeltaChip delta={computeDelta(data.points)} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {state === "ready" ? (
          <ChartContainer
            config={chartConfig}
            className={`${CHART_HEIGHT.compact} w-full`}
            role="region"
            aria-label="Score history"
          >
            <LineChart
              accessibilityLayer
              data={data.points}
              margin={CHART_MARGIN}
            >
              <CartesianGrid {...GRID_PROPS} />
              <XAxis {...TIME_AXIS_PROPS} />
              <YAxis {...VALUE_AXIS_PROPS} domain={[0, 100]} />
              <ChartTooltip
                content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
              />
              {rubricChange ? (
                <ReferenceLine
                  x={rubricChange}
                  stroke="var(--border)"
                  label="Rubric v2"
                />
              ) : null}
              <Line
                {...LINE_PROPS}
                dataKey="overall"
                stroke="var(--color-overall)"
                connectNulls={false}
              />
            </LineChart>
          </ChartContainer>
        ) : state === "empty" ? (
          <ChartNotice
            height={CHART_HEIGHT.compact}
            title="No audit snapshots yet"
            body="The daily audit snapshot builds this trend."
          />
        ) : (
          <ChartStat
            height={CHART_HEIGHT.compact}
            label={`Last daily snapshot · ${formatDate(lastPoint.date)}`}
            value={String(lastPoint.overall)}
            note="A trend needs a few more daily snapshots."
          />
        )}
      </CardContent>
    </Card>
  );
}
