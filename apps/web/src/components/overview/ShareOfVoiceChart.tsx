"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { AppAnnotationItem } from "@asobeast/shared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@/components/ui/chart";
import { SeriesLegend } from "@/components/charts/SeriesLegend";
import { SeriesTooltip } from "@/components/charts/SeriesTooltip";
import { AnnotationTooltipNotes } from "@/components/annotations/AnnotationTooltipNotes";
import {
  annotationLines,
  annotationsInScope,
  annotationsOn,
} from "@/components/annotations/annotation-lines";
import {
  ChartNotice,
  ChartStat,
  trendState,
} from "@/components/charts/ChartStates";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  GRID_PROPS,
  LINE_PROPS,
  seriesColor,
  seriesDash,
  TIME_AXIS_PROPS,
  VALUE_AXIS_PROPS,
} from "@/components/charts/theme";
import { formatDayMonthInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  annotationsOptions,
  appSummaryOptions,
  visibilityOptions,
} from "@/lib/queries";
import { presetToRange, todayUtc, type VisibilityRange } from "@/lib/ranges";
import {
  hasNonBranded,
  shareSeries,
  type ShareRow,
} from "./share-of-voice-series";
import {
  competitorsCaption,
  formatShare,
  shareReason,
} from "./share-of-voice-text";

function ShareTooltip({
  active,
  label,
  rows,
  annotations,
}: {
  active?: boolean;
  label?: string | number;
  rows: ShareRow[];
  annotations: AppAnnotationItem[];
}) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  if (!active || label === undefined) return null;
  const row = rows.find((candidate) => candidate.date === label);
  if (!row) return null;
  const items = (["share", "nonBranded"] as const).flatMap((key, index) => {
    const value = row[key];
    return value === undefined
      ? []
      : [
          {
            key,
            index,
            color: `var(--color-${key})`,
            label:
              key === "share"
                ? t("metrics.shareOfVoice")
                : t("charts.nonBranded"),
            value: formatShare(value, locale),
            sortBy: value,
          },
        ];
  });
  return (
    <SeriesTooltip
      title={formatDayMonthInLocale(String(label), locale)}
      items={items}
      footer={
        <>
          <p className="text-muted-foreground">
            {competitorsCaption(row.competitors, t)}
          </p>
          <AnnotationTooltipNotes
            annotations={annotationsOn(annotations, String(label))}
          />
        </>
      }
    />
  );
}

function NoShare({ id, country }: { id: string; country?: string }) {
  const t = useTranslations("overview");
  const { data: summary } = useQuery(appSummaryOptions(id, country));
  const reason = summary?.shareOfVoice?.reason;
  if (reason === "noCompetitors") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.tall}
        title={t("charts.addCompetitorTitle")}
        body={t("charts.addCompetitorBody")}
      />
    );
  }
  return (
    <ChartNotice
      height={CHART_HEIGHT.tall}
      title={t("charts.noShareTitle")}
      body={t("charts.shareUnavailable", {
        reason: shareReason(reason, t),
      })}
    />
  );
}

export function ShareOfVoiceChart({
  id,
  range,
}: {
  id: string;
  range: VisibilityRange;
}) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const { country } = useKeywordScope(id);
  const { data } = useSuspenseQuery(
    visibilityOptions(id, presetToRange(range), country, "competitors"),
  );
  const shareConfig = {
    share: { label: t("metrics.shareOfVoice"), color: seriesColor(0) },
    nonBranded: { label: t("charts.nonBranded"), color: seriesColor(1) },
  } satisfies ChartConfig;
  const { data: annotations } = useQuery(annotationsOptions(id));
  const rows = shareSeries(data);
  const inScope = annotationsInScope(annotations?.annotations ?? [], country);
  const marked = annotationLines(
    inScope,
    rows.map((row) => row.date),
    todayUtc(),
  );
  const twoLines = hasNonBranded(data);

  const state = trendState(rows.length);
  if (state === "empty") return <NoShare id={id} country={country} />;
  if (state === "insufficient") {
    const latest = rows[rows.length - 1];
    return (
      <ChartStat
        height={CHART_HEIGHT.tall}
        label={t("charts.latestShare")}
        value={
          latest.share === undefined ? "—" : formatShare(latest.share, locale)
        }
        note={t("charts.trendNeedsChecks")}
      />
    );
  }

  return (
    <ChartContainer
      config={shareConfig}
      className={`${CHART_HEIGHT.tall} w-full`}
      role="region"
      aria-label={t("charts.shareOverTime")}
    >
      <LineChart accessibilityLayer data={rows} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis {...TIME_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} domain={[0, 100]} />
        {marked.map((annotation) => (
          <ReferenceLine
            key={annotation.id}
            x={annotation.date}
            stroke="var(--info)"
            strokeDasharray="6 3"
          />
        ))}
        <ChartTooltip
          content={<ShareTooltip rows={rows} annotations={inScope} />}
        />
        <ChartLegend
          content={
            <SeriesLegend
              labels={{
                share: t("metrics.shareOfVoice"),
                nonBranded: t("charts.nonBranded"),
              }}
              order={twoLines ? ["share", "nonBranded"] : ["share"]}
            />
          }
        />
        <Line
          {...LINE_PROPS}
          dataKey="share"
          stroke="var(--color-share)"
          strokeDasharray={seriesDash(0)}
          connectNulls={false}
        />
        {twoLines ? (
          <Line
            {...LINE_PROPS}
            dataKey="nonBranded"
            stroke="var(--color-nonBranded)"
            strokeDasharray={seriesDash(1)}
            connectNulls={false}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
