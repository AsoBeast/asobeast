"use client";

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
import { changesOptions, rankingsOptions } from "@/lib/queries";
import { formatDayMonth } from "@/lib/format";
import {
  presetDays,
  presetToRange,
  RANGE_PRESETS,
  type RangePreset,
} from "@/lib/ranges";
import { PositionHistoryChart } from "./PositionHistoryChart";
import {
  changedFieldsLabel,
  historyView,
  listingChangeDays,
} from "./position-history";

const WIDEST = RANGE_PRESETS[RANGE_PRESETS.length - 1];

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
  const read = useQuery({
    ...rankingsOptions(appId, { ...bounds, keywordIds: [keyword.keywordId] }),
    placeholderData: keepPreviousData,
  });
  const { data: timeline } = useQuery({
    ...changesOptions(
      appId,
      presetDays(range),
      keyword.country === homeCountry ? undefined : keyword.country,
    ),
    placeholderData: keepPreviousData,
  });

  if (read.data) {
    const chart = buildRankingChart(
      read.data.series.filter((item) => item.keywordId === keyword.keywordId),
      bounds.to,
    );
    const view = historyView(chart, keyword);
    if (view.kind === "empty") {
      return (
        <ChartNotice
          height={CHART_HEIGHT.compact}
          title={`No checks in the last ${presetDays(range)} days`}
          action={
            range === WIDEST ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRange(WIDEST)}
              >
                Show {presetDays(WIDEST)} days
              </Button>
            )
          }
        />
      );
    }
    const changes = plottedChanges(
      listingChangeDays(timeline?.events ?? [], {
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
  return <ChartSkeleton height={CHART_HEIGHT.compact} />;
}
