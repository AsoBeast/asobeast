"use client";

import { useRef } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { keywordLabel } from "@asobeast/shared";
import { X } from "lucide-react";
import { PrintReportButton } from "@/components/app-detail/PrintReportButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  annotationsOptions,
  appDetailOptions,
  changesOptions,
  keywordsOptions,
  rankingsOptions,
} from "@/lib/queries";
import {
  presetDays,
  presetToRange,
  RANGE_PRESETS,
  WIDEST_RANGE,
} from "@/lib/ranges";
import { keywordIdsParser, rangeParser } from "@/lib/search-params";
import { ChartImageButtons } from "@/components/charts/ChartImageButtons";
import { annotationsInMarkets } from "@/components/annotations/annotation-lines";
import { MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import { exportRankings } from "./ranking-csv";
import { rankingImageSpec } from "./ranking-image";
import { buildRankingChart, MAX_SERIES } from "./pivot";
import {
  InsufficientHistory,
  NoDataInRange,
  NoKeywordsTracked,
  NoPositionsYet,
} from "./RankingStates";
import { KeywordPicker } from "./KeywordPicker";
import { RangePicker } from "./RangePicker";
import { RankingChart } from "./RankingChart";
import { DEFAULT_SELECTION, topByOpportunity } from "./selection";

export function RankingsView({ id }: { id: string }) {
  const [range, setRange] = useQueryState("range", rangeParser);
  const [selected, setSelected] = useQueryState("keywords", keywordIdsParser);
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id));
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const chartRef = useRef<HTMLDivElement>(null);

  const effective =
    selected.length > 0
      ? selected
      : topByOpportunity(tracked, DEFAULT_SELECTION);

  const bounds = presetToRange(range);
  const { data } = useSuspenseQuery(
    rankingsOptions(id, { ...bounds, keywordIds: effective }),
  );
  const { data: changes } = useQuery(changesOptions(id, presetDays(range)));
  const { data: annotations } = useQuery(annotationsOptions(id));
  const inScope = annotationsInMarkets(annotations?.annotations ?? [], [
    ...new Set(data.series.map((item) => item.country)),
  ]);
  const changeDates = (changes?.events ?? [])
    .filter((event) => !event.isCompetitor)
    .map((event) => event.capturedAt.slice(0, 10));

  const everChecked = tracked.some(
    (item) => effective.includes(item.keywordId) && item.latestDepth !== null,
  );

  const chart = buildRankingChart(data.series, bounds.to);
  const labels = new Map(
    tracked.map((item) => [item.keywordId, keywordLabel(item)]),
  );

  const imageReady =
    tracked.length > 0 && chart.checkedDays >= MIN_TREND_POINTS;
  const makeImageJob = () => {
    const container = chartRef.current;
    const spec = rankingImageSpec({
      chart,
      kind: "rankings",
      title: "Keyword rank positions",
      app: detail,
      countries: data.series.slice(0, MAX_SERIES).map((item) => item.country),
    });
    return container && spec ? { container, ...spec } : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription>Ranking history</CardDescription>
        <CardTitle>Keyword positions over time</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <KeywordPicker id={id} value={effective} onChange={setSelected} />
          <RangePicker
            presets={RANGE_PRESETS}
            value={range}
            onChange={setRange}
            label="Date range"
          />
          {effective.map((keywordId) => (
            <button
              key={keywordId}
              type="button"
              aria-label={`Remove ${labels.get(keywordId) ?? keywordId} from the chart`}
              onClick={() =>
                setSelected(effective.filter((item) => item !== keywordId))
              }
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted print:border-0 print:px-0 print:py-0"
            >
              <span
                data-swatch
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: chart.config[keywordId]?.color }}
              />
              <span className="max-w-40 truncate print:max-w-none print:whitespace-normal">
                {labels.get(keywordId) ?? keywordId}
              </span>
              <X className="size-3 opacity-60 print:hidden" aria-hidden />
            </button>
          ))}
          <ExportCsvButton
            subject="rankings"
            className="ml-auto print:hidden"
            disabled={chart.checkedDays === 0}
            onClick={() => exportRankings(id, bounds, chart)}
          />
          {imageReady ? (
            <ChartImageButtons
              subject="the rankings chart"
              makeJob={makeImageJob}
            />
          ) : null}
          <PrintReportButton />
        </div>

        {tracked.length === 0 ? (
          <NoKeywordsTracked id={id} />
        ) : chart.checkedDays === 0 ? (
          everChecked ? (
            <NoDataInRange
              onWiden={
                range === WIDEST_RANGE
                  ? undefined
                  : () => void setRange(WIDEST_RANGE)
              }
            />
          ) : (
            <NoPositionsYet />
          )
        ) : chart.checkedDays < MIN_TREND_POINTS ? (
          <InsufficientHistory data={chart} />
        ) : (
          <>
            <RankingChart
              chartRef={chartRef}
              data={chart}
              changeDates={changeDates}
              annotations={inScope}
            />
            {chart.totalSeries > MAX_SERIES ? (
              <p className="text-caption text-muted-foreground">
                Showing {MAX_SERIES} of {chart.totalSeries} keywords.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
