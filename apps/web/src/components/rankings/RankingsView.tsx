"use client";

import { Suspense, useRef, type RefObject } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { AppAnnotationItem, TrackedKeywordItem } from "@asobeast/shared";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  annotationsOptions,
  appDetailOptions,
  changesOptions,
  keywordsOptions,
  rankingsOptions,
} from "@/lib/queries";
import { survivingNeighbour, useFocusAfterCommit } from "@/lib/focus-handoff";
import { formatDate } from "@/lib/format";
import {
  presetDays,
  presetToRange,
  RANGE_PRESETS,
  WIDEST_RANGE,
  type RangePreset,
} from "@/lib/ranges";
import { ChartImageButtons } from "@/components/charts/ChartImageButtons";
import {
  countryParser,
  keywordIdsParser,
  rangeParser,
  RANKINGS_VIEWS,
  rankingsViewParser,
  type RankingsView as RankingsViewName,
} from "@/lib/search-params";
import { annotationsInMarkets } from "@/components/annotations/annotation-lines";
import { MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import { exportRankings } from "./ranking-csv";
import { rankingImageSpec } from "./ranking-image";
import {
  buildRankingChart,
  MAX_SERIES,
  type RankingChartData,
} from "@/components/charts/pivot";
import {
  InsufficientHistory,
  NoDataInRange,
  NoKeywordsInMarket,
  NoKeywordsTracked,
  NoPositionsYet,
} from "@/components/charts/RankingStates";
import { KeywordPicker, KEYWORD_PICKER_ID } from "./KeywordPicker";
import { PositionsByDay, RankTierKey } from "./PositionsByDay";
import { RankingsPanelSkeleton } from "./skeletons";
import { RangePicker } from "./RangePicker";
import { RankingKey } from "./RankingKey";
import { chartMarks, RankingChart } from "@/components/charts/RankingChart";
import { selectionForMarket } from "./selection";
import { lastCheckedDay, seriesStats, type SeriesStats } from "./series-stats";
import { seriesRemoveId, SeriesStatsTable } from "./SeriesStatsTable";

const VIEW_LABELS: Record<RankingsViewName, string> = {
  chart: "Chart",
  days: "By day",
};

function checkFacts(
  stats: readonly SeriesStats[],
  through: string | null,
  totalSeries: number,
): string | null {
  const depths = stats.flatMap((row) => (row.latest ? [row.latest.depth] : []));
  const facts = [
    ...(depths.length > 0 ? [`Checked to depth ${Math.max(...depths)}`] : []),
    ...(through === null ? [] : [`last check ${formatDate(through)}`]),
    ...(totalSeries > MAX_SERIES
      ? [`showing ${MAX_SERIES} of ${totalSeries} keywords`]
      : []),
  ];
  return facts.length === 0 ? null : facts.join(" · ");
}

export function RankingsView({ id }: { id: string }) {
  const [country] = useQueryState("country", countryParser);
  const [range, setRange] = useQueryState("range", rangeParser);
  const [view, setView] = useQueryState("view", rankingsViewParser);
  const [selected, setSelected] = useQueryState("keywords", keywordIdsParser);
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id));

  const scoped = country
    ? tracked.filter((item) => item.country === country)
    : tracked;
  const effective = selectionForMarket(scoped, selected);

  return (
    <Card>
      <CardHeader
        className={`${PANEL_HEADER} flex flex-wrap items-center justify-between gap-x-4 gap-y-2`}
      >
        <CardTitle asChild>
          <h2>Keyword positions</h2>
        </CardTitle>
        <CardAction
          className={`${PANEL_ACTION} flex flex-wrap items-center gap-2`}
        >
          <KeywordPicker
            tracked={scoped}
            value={effective}
            onChange={setSelected}
          />
          <Tabs
            value={view}
            onValueChange={(next) =>
              void setView(rankingsViewParser.parse(next))
            }
          >
            <TabsList aria-label="Positions view" className="print:hidden">
              {RANKINGS_VIEWS.map((value) => (
                <TabsOption key={value} value={value}>
                  {VIEW_LABELS[value]}
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>
          <RangePicker
            presets={RANGE_PRESETS}
            value={range}
            onChange={setRange}
            label="Date range"
          />
        </CardAction>
      </CardHeader>
      <Suspense fallback={<RankingsPanelSkeleton />}>
        <RankingsPanel
          id={id}
          country={country || undefined}
          tracked={tracked}
          scoped={scoped}
          effective={effective}
          range={range}
          view={view}
          onWiden={() => void setRange(WIDEST_RANGE)}
          onSelect={(next) => void setSelected(next)}
        />
      </Suspense>
    </Card>
  );
}

function RankingsPanel({
  id,
  country,
  tracked,
  scoped,
  effective,
  range,
  view,
  onWiden,
  onSelect,
}: {
  id: string;
  country: string | undefined;
  tracked: TrackedKeywordItem[];
  scoped: TrackedKeywordItem[];
  effective: string[];
  range: RangePreset;
  view: RankingsViewName;
  onWiden: () => void;
  onSelect: (keywordIds: string[]) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const focusAfterCommit = useFocusAfterCommit();
  const bounds = presetToRange(range);
  const { data } = useSuspenseQuery(
    rankingsOptions(id, { ...bounds, keywordIds: effective }),
  );
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const { data: changes } = useQuery(
    changesOptions(id, presetDays(range), country),
  );
  const { data: annotations } = useQuery(annotationsOptions(id));
  const shownSeries = data.series.slice(0, MAX_SERIES);
  const inScope = annotationsInMarkets(annotations?.annotations ?? [], [
    ...new Set(shownSeries.map((item) => item.country)),
  ]);
  const changeDates = (changes?.events ?? [])
    .filter((event) => !event.isCompetitor)
    .map((event) => event.capturedAt.slice(0, 10));

  const chart = buildRankingChart(data.series, bounds.to);
  const through = lastCheckedDay(shownSeries);
  const stats = shownSeries.map((item) => seriesStats(item, through));
  const facts = checkFacts(stats, through, chart.totalSeries);

  const imageReady =
    view === "chart" &&
    scoped.length > 0 &&
    chart.checkedDays >= MIN_TREND_POINTS;
  const makeImageJob = () => {
    const container = chartRef.current;
    const spec = rankingImageSpec({
      chart,
      kind: "rankings",
      title: "Keyword rank positions",
      app: detail,
      countries: shownSeries.map((item) => item.country),
    });
    return container && spec ? { container, ...spec } : null;
  };

  const remove = (keywordId: string, trigger: HTMLElement) => {
    const remaining = effective.filter((item) => item !== keywordId);
    const neighbour = survivingNeighbour(
      stats,
      (row) => row.keywordId === keywordId,
    );
    focusAfterCommit(
      document.getElementById(
        remaining.length > 0 && neighbour
          ? seriesRemoveId(neighbour.keywordId)
          : KEYWORD_PICKER_ID,
      ),
      trigger,
    );
    onSelect(remaining);
  };

  return (
    <>
      <RankingsBody
        id={id}
        country={country}
        tracked={tracked}
        scoped={scoped}
        charted={effective}
        chart={chart}
        stats={stats}
        range={range}
        view={view}
        changeDates={changeDates}
        annotations={inScope}
        chartRef={chartRef}
        onWiden={onWiden}
        onRemove={remove}
      />
      <CardFooter className="flex-wrap justify-between gap-y-2">
        {facts === null ? <span /> : <span>{facts}</span>}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ExportCsvButton
            subject="rankings"
            disabled={scoped.length === 0 || chart.checkedDays === 0}
            onClick={() => exportRankings(id, bounds, chart)}
          />
          {imageReady ? (
            <ChartImageButtons
              subject="the rankings chart"
              makeJob={makeImageJob}
            />
          ) : null}
        </div>
      </CardFooter>
    </>
  );
}

function RankingsBody({
  id,
  country,
  tracked,
  scoped,
  charted,
  chart,
  stats,
  range,
  view,
  changeDates,
  annotations,
  chartRef,
  onWiden,
  onRemove,
}: {
  id: string;
  country: string | undefined;
  tracked: TrackedKeywordItem[];
  scoped: TrackedKeywordItem[];
  charted: readonly string[];
  chart: RankingChartData;
  stats: readonly SeriesStats[];
  range: RangePreset;
  view: RankingsViewName;
  changeDates: string[];
  annotations: AppAnnotationItem[];
  chartRef: RefObject<HTMLDivElement | null>;
  onWiden: () => void;
  onRemove: (keywordId: string, trigger: HTMLElement) => void;
}) {
  if (tracked.length === 0) {
    return (
      <CardContent>
        <NoKeywordsTracked id={id} />
      </CardContent>
    );
  }
  if (scoped.length === 0 && country) {
    return (
      <CardContent>
        <NoKeywordsInMarket id={id} country={country} />
      </CardContent>
    );
  }
  if (chart.checkedDays === 0) {
    const everChecked = tracked.some(
      (item) => charted.includes(item.keywordId) && item.latestDepth !== null,
    );
    return (
      <CardContent>
        {everChecked ? (
          <NoDataInRange
            onWiden={range === WIDEST_RANGE ? undefined : onWiden}
          />
        ) : (
          <NoPositionsYet />
        )}
      </CardContent>
    );
  }
  if (view === "days") {
    return (
      <>
        <CardContent className="flex justify-end text-label text-muted-foreground">
          <RankTierKey />
        </CardContent>
        <div className="-mb-(--card-spacing) border-t border-border">
          <PositionsByDay chart={chart} rows={stats} />
        </div>
      </>
    );
  }
  const key = (
    <div className="-mb-(--card-spacing) border-t border-border">
      <SeriesStatsTable rows={stats} range={range} onRemove={onRemove} />
    </div>
  );
  if (chart.checkedDays < MIN_TREND_POINTS) {
    return (
      <>
        <CardContent>
          <InsufficientHistory data={chart} />
        </CardContent>
        {key}
      </>
    );
  }
  const marks = chartMarks(chart, changeDates, annotations);
  return (
    <>
      <CardContent className="flex flex-col gap-2">
        <RankingKey
          changes={marks.changes.length > 0}
          annotations={marks.annotations.length > 0}
        />
        <RankingChart
          chartRef={chartRef}
          data={chart}
          changeDates={changeDates}
          annotations={annotations}
          ownKey
        />
      </CardContent>
      {key}
    </>
  );
}
