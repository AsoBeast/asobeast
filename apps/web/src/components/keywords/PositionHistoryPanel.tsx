"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ChangeField, TrackedKeywordItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ChartNotice, ChartSkeleton } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import {
  buildRankingChart,
  type RankingChartData,
} from "@/components/rankings/pivot";
import { RangePicker } from "@/components/rankings/RangePicker";
import { changesOptions, rankingsOptions } from "@/lib/queries";
import { formatDayMonth } from "@/lib/format";
import { queryMarket } from "@/lib/market";
import {
  presetDays,
  presetToRange,
  RANGE_PRESETS,
  type RangePreset,
  WIDEST_RANGE,
} from "@/lib/ranges";
import { PositionHistoryChart } from "./PositionHistoryChart";
import {
  changedFieldsLabel,
  historyView,
  listingChangeDays,
  rankingsHistoryHref,
  type HistoryView,
} from "./position-history";

function plottedChanges(
  days: Map<string, ChangeField[]>,
  chart: RankingChartData,
): Map<string, ChangeField[]> {
  const plotted = new Set(chart.rows.map((row) => String(row.date)));
  return new Map(
    [...days]
      .filter(([day]) => plotted.has(day))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function ChangesLine({ changes }: { changes: Map<string, ChangeField[]> }) {
  if (changes.size === 0) return null;
  const days = [...changes].map(
    ([day, fields]) => `${formatDayMonth(day)} ${changedFieldsLabel(fields)}`,
  );
  return (
    <p className="text-caption text-muted-foreground">
      Listing changes: {days.join(" · ")}
    </p>
  );
}

type ChangesRead = ReturnType<typeof useChangesRead>;
type RankingsRead = ReturnType<typeof useRankingsRead>;

function PositionHistoryControls({
  appId,
  keywordId,
  range,
  onRange,
}: {
  appId: string;
  keywordId: string;
  range: RangePreset;
  onRange: (next: RangePreset) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <RangePicker
        presets={RANGE_PRESETS}
        value={range}
        onChange={onRange}
        label="Date range"
      />
      <Button asChild variant="link" size="sm" className="px-0">
        <Link href={rankingsHistoryHref(appId, keywordId, range)}>
          Open in Rankings
        </Link>
      </Button>
    </div>
  );
}

function useRankingsRead(
  appId: string,
  keywordId: string,
  bounds: { from: string; to: string },
) {
  return useQuery({
    ...rankingsOptions(appId, { ...bounds, keywordIds: [keywordId] }),
    placeholderData: keepPreviousData,
  });
}

function useChangesRead(
  appId: string,
  keyword: TrackedKeywordItem,
  homeCountry: string,
  range: RangePreset,
) {
  return useQuery({
    ...changesOptions(
      appId,
      presetDays(range),
      queryMarket(keyword.country, homeCountry),
    ),
    placeholderData: keepPreviousData,
  });
}

function PositionHistoryBody({
  keyword,
  homeCountry,
  range,
  onRange,
  read,
  changesRead,
  chart,
  view,
}: {
  keyword: TrackedKeywordItem;
  homeCountry: string;
  range: RangePreset;
  onRange: (next: RangePreset) => void;
  read: RankingsRead;
  changesRead: ChangesRead;
  chart: RankingChartData | null;
  view: HistoryView | null;
}) {
  if (chart && view) {
    if (view.kind === "empty") {
      return (
        <ChartNotice
          height={CHART_HEIGHT.compact}
          title={`No checks in the last ${presetDays(range)} days`}
          action={
            range === WIDEST_RANGE ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRange(WIDEST_RANGE)}
              >
                Show {presetDays(WIDEST_RANGE)} days
              </Button>
            )
          }
        />
      );
    }
    const changes = plottedChanges(
      listingChangeDays(changesRead.data?.events ?? [], {
        country: keyword.country,
        homeCountry,
      }),
      chart,
    );
    return (
      <div className="flex flex-col gap-2">
        <PositionHistoryChart
          data={chart}
          line={view.line}
          best={keyword.bestPosition ?? null}
          changes={changes}
          label={`Position history of ${keyword.text}`}
          busy={read.isPlaceholderData}
        />
        {view.notes.map((note) => (
          <p key={note} className="text-caption text-muted-foreground">
            {note}
          </p>
        ))}
        <ChangesLine changes={changes} />
        {failedRead(changesRead) ? (
          <InlineQueryError
            message="Could not load the listing changes."
            read={changesRead}
          />
        ) : null}
      </div>
    );
  }
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="Could not load the position history."
        read={read}
      />
    );
  }
  return (
    <ChartSkeleton
      height={CHART_HEIGHT.compact}
      className="border border-dashed"
    />
  );
}

export function PositionHistoryPanel({
  appId,
  keyword,
  homeCountry,
  range,
  onRange,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
  homeCountry: string;
  range: RangePreset;
  onRange: (next: RangePreset) => void;
}) {
  const bounds = presetToRange(range);
  const read = useRankingsRead(appId, keyword.keywordId, bounds);
  const changesRead = useChangesRead(appId, keyword, homeCountry, range);
  const chart = read.data
    ? buildRankingChart(
        read.data.series.filter((item) => item.keywordId === keyword.keywordId),
        bounds.to,
      )
    : null;
  const view = chart ? historyView(chart, keyword) : null;

  return (
    <>
      <PositionHistoryControls
        appId={appId}
        keywordId={keyword.keywordId}
        range={range}
        onRange={onRange}
      />
      <PositionHistoryBody
        keyword={keyword}
        homeCountry={homeCountry}
        range={range}
        onRange={onRange}
        read={read}
        changesRead={changesRead}
        chart={chart}
        view={view}
      />
    </>
  );
}
