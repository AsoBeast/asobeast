"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
  timeAxisPropsInLocale,
  TIME_TOOLTIP_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import { auditHistoryOptions } from "@/lib/queries";
import { presetToRange, type VisibilityRange } from "@/lib/ranges";
import { rubricChanges } from "./rubric-changes";
import { scoredPoints } from "./score-history";

const HEIGHT = CHART_HEIGHT.tall;
const SERIES = seriesColor(0);
const REACHABLE = "var(--muted-foreground)";
const LABEL_STAGGER = 14;

function keyItems(
  potential: number | null,
  hasRubricChange: boolean,
  t: MessageTranslator,
): ChartKeyItem[] {
  return [
    { label: t("score"), color: SERIES, mark: "line" },
    ...(potential === null
      ? []
      : [
          {
            label: t("history.reachable", { score: Math.round(potential) }),
            color: REACHABLE,
            mark: "dash" as const,
          },
        ]),
    ...(hasRubricChange
      ? [
          {
            label: t("history.rubricChange"),
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
  const t = useTranslations("audit");
  const locale = useAppLocale();
  const chartConfig = {
    overall: { label: t("score"), color: SERIES },
  } satisfies ChartConfig;
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
        title={t("history.emptyTitle")}
        body={t("history.emptyBody")}
      />
    );
  }
  if (state === "insufficient") {
    const last = points[points.length - 1];
    return (
      <ChartStat
        height={HEIGHT}
        label={t("history.lastSnapshot", {
          date: formatDateInLocale(last.date, locale),
        })}
        value={String(last.overall)}
        note={t("history.shortNote")}
      />
    );
  }

  const changes = rubricChanges(data.points);

  return (
    <div className="flex flex-col gap-2">
      <ChartKey
        label={t("history.key")}
        items={keyItems(potential, changes.length > 0, t)}
      />
      <ChartContainer
        config={chartConfig}
        className={`${HEIGHT} w-full`}
        role="region"
        aria-label={t("history.aria")}
      >
        <ComposedChart
          accessibilityLayer
          data={data.points}
          margin={CHART_MARGIN}
        >
          <SeriesFade id={fadeId} color={SERIES} />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...timeAxisPropsInLocale(locale)} />
          <YAxis {...VALUE_AXIS_PROPS} {...SCORE_AXIS_PROPS} />
          <ChartTooltip
            content={<ChartTooltipContent {...TIME_TOOLTIP_PROPS} />}
          />
          {changes.map((change, index) => (
            <ReferenceLine
              key={`${change.date}-${change.version}`}
              x={change.date}
              {...CHANGE_MARKER_PROPS}
              label={{
                value: t("history.rubricLabel", { version: change.version }),
                position:
                  change.labelPosition === "insideRight"
                    ? "insideTopRight"
                    : "insideTopLeft",
                dy: (index % 2) * LABEL_STAGGER,
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
