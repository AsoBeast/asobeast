"use client";

import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type {
  ChangeTimeline,
  RankingSeries as RankingSeriesContract,
  TrackedKeywordItem,
} from "@asobeast/shared";
import {
  ChartSkeleton,
  MIN_TREND_POINTS,
} from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  buildRankingChart,
  type RankingChartData,
} from "@/components/charts/pivot";
import { RankingChart } from "@/components/charts/RankingChart";
import {
  InsufficientHistory,
  NoDataInRange,
  NoKeywordsInMarket,
  NoPositionsYet,
} from "@/components/charts/RankingStates";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import {
  changesOptions,
  keywordsOptions,
  rankingsOptions,
} from "@/lib/queries";
import { queryMarket } from "@/lib/market";
import {
  presetDays,
  presetToRange,
  WIDEST_RANGE,
  type RangePreset,
} from "@/lib/ranges";
import { keywordChartSelectionParser } from "@/lib/search-params";
import { survivingNeighbour, useFocusAfterCommit } from "@/lib/focus-handoff";
import { listingChangeDays } from "./position-history";
import {
  cappingLine,
  isCapped,
  withoutKeyword,
  type ChartedSelection,
} from "./dynamics-selection";
import { dynamicsChipId, DynamicsChips } from "./DynamicsChips";

export function KeywordDynamicsChart({
  id,
  market,
  homeCountry,
  chart,
  range,
  onClear,
  onWiden,
}: {
  id: string;
  market: string;
  homeCountry: string;
  chart: ChartedSelection;
  range: RangePreset;
  onClear: () => void;
  onWiden: () => void;
}) {
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id, market));
  if (tracked.length === 0) {
    return <NoKeywordsInMarket id={id} country={market} action={null} />;
  }
  return (
    <KeywordDynamicsBody
      id={id}
      market={market}
      homeCountry={homeCountry}
      chart={chart}
      range={range}
      tracked={tracked}
      onClear={onClear}
      onWiden={onWiden}
    />
  );
}

function KeywordDynamicsBody({
  id,
  market,
  homeCountry,
  chart,
  range,
  tracked,
  onClear,
  onWiden,
}: {
  id: string;
  market: string;
  homeCountry: string;
  chart: ChartedSelection;
  range: RangePreset;
  tracked: TrackedKeywordItem[];
  onClear: () => void;
  onWiden: () => void;
}) {
  const [, setKeywords] = useQueryState(
    "keywords",
    keywordChartSelectionParser,
  );
  const focusAfterCommit = useFocusAfterCommit();
  const bounds = presetToRange(range);
  const rankingsRead = useQuery({
    ...rankingsOptions(id, { ...bounds, keywordIds: chart.charted }),
    placeholderData: keepPreviousData,
  });
  const changesRead = useQuery(
    changesOptions(id, presetDays(range), queryMarket(market, homeCountry)),
  );

  const data = rankingsRead.data;
  const seriesIds = new Set(data?.series.map((item) => item.keywordId) ?? []);
  const selectionPending =
    rankingsRead.isPlaceholderData &&
    (seriesIds.size !== chart.charted.length ||
      chart.charted.some((keywordId) => !seriesIds.has(keywordId)));

  if (failedRead(rankingsRead)) {
    return (
      <InlineQueryError
        message="Could not load the rank positions."
        read={rankingsRead}
      />
    );
  }
  if (!data) {
    return <ChartSkeleton height={CHART_HEIGHT.hero} />;
  }

  const chartData = buildRankingChart(data.series, bounds.to);
  const changeDays = listingChangeDays(changesRead.data?.events ?? [], {
    country: market,
    homeCountry,
  });

  const removeChip = (keywordId: string, trigger: HTMLElement) => {
    const remaining = withoutKeyword(chart.effective, keywordId);
    if (remaining.length === 0) {
      onClear();
      return;
    }
    const neighbour = survivingNeighbour(
      chart.charted,
      (candidate) => candidate === keywordId,
    );
    focusAfterCommit(
      neighbour === undefined
        ? null
        : document.getElementById(dynamicsChipId(neighbour)),
      trigger,
    );
    void setKeywords({ mode: "chart", ids: remaining });
  };

  return (
    <div className="flex flex-col gap-3">
      <DynamicsChips
        selected={chart.charted}
        tracked={tracked}
        chart={chartData}
        onRemove={removeChip}
      />
      <DynamicsChartArea
        chartData={chartData}
        selectionPending={selectionPending}
        charted={chart.charted}
        tracked={tracked}
        changeDays={[...changeDays.keys()]}
        onWiden={onWiden}
        range={range}
      />
      {isCapped(chart) ? (
        <p className="text-caption text-muted-foreground">
          {cappingLine(chart)}
        </p>
      ) : null}
      <DynamicsReadErrors
        rankingsRead={rankingsRead}
        changesRead={changesRead}
      />
    </div>
  );
}

function DynamicsChartArea({
  chartData,
  selectionPending,
  charted,
  tracked,
  changeDays,
  onWiden,
  range,
}: {
  chartData: RankingChartData;
  selectionPending: boolean;
  charted: readonly string[];
  tracked: TrackedKeywordItem[];
  changeDays: string[];
  onWiden: () => void;
  range: RangePreset;
}) {
  if (selectionPending) {
    return <ChartSkeleton height={CHART_HEIGHT.hero} />;
  }
  if (chartData.checkedDays === 0) {
    const everChecked = tracked.some(
      (item) => charted.includes(item.keywordId) && item.latestDepth !== null,
    );
    return everChecked ? (
      <NoDataInRange onWiden={range === WIDEST_RANGE ? undefined : onWiden} />
    ) : (
      <NoPositionsYet />
    );
  }
  if (chartData.checkedDays < MIN_TREND_POINTS) {
    return <InsufficientHistory data={chartData} />;
  }
  return <RankingChart data={chartData} changeDates={changeDays} />;
}

function DynamicsReadErrors({
  rankingsRead,
  changesRead,
}: {
  rankingsRead: UseQueryResult<RankingSeriesContract>;
  changesRead: UseQueryResult<ChangeTimeline>;
}) {
  return (
    <>
      {rankingsRead.isError ? (
        <InlineQueryError
          message="Could not refresh the rank positions."
          read={rankingsRead}
        />
      ) : null}
      {failedRead(changesRead) ? (
        <InlineQueryError
          message="Could not load the listing changes."
          read={changesRead}
        />
      ) : null}
    </>
  );
}
