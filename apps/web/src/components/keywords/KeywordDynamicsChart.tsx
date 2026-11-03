"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import { buildRankingChart } from "@/components/charts/pivot";
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
import { keywordIdsParser } from "@/lib/search-params";
import { survivingNeighbour, useFocusAfterCommit } from "@/lib/focus-handoff";
import { listingChangeDays } from "./position-history";
import {
  cappingLine,
  chartedSelection,
  isCapped,
  withoutKeyword,
} from "./dynamics-selection";
import { dynamicsChipId, DynamicsChips } from "./DynamicsChips";

export function KeywordDynamicsChart({
  id,
  market,
  homeCountry,
  selected,
  range,
  onClear,
  onWiden,
}: {
  id: string;
  market: string;
  homeCountry: string;
  selected: readonly string[];
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
      selected={selected}
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
  selected,
  range,
  tracked,
  onClear,
  onWiden,
}: {
  id: string;
  market: string;
  homeCountry: string;
  selected: readonly string[];
  range: RangePreset;
  tracked: TrackedKeywordItem[];
  onClear: () => void;
  onWiden: () => void;
}) {
  const [, setKeywords] = useQueryState("keywords", keywordIdsParser);
  const focusAfterCommit = useFocusAfterCommit();
  const selection = chartedSelection(selected, tracked);
  const bounds = presetToRange(range);
  const { data } = useSuspenseQuery(
    rankingsOptions(id, { ...bounds, keywordIds: selection.charted }),
  );
  const changesRead = useQuery(
    changesOptions(id, presetDays(range), queryMarket(market, homeCountry)),
  );

  const chart = buildRankingChart(data.series, bounds.to);
  const everChecked = tracked.some(
    (item) =>
      selection.charted.includes(item.keywordId) && item.latestDepth !== null,
  );
  const changeDays = listingChangeDays(changesRead.data?.events ?? [], {
    country: market,
    homeCountry,
  });

  const removeChip = (keywordId: string, trigger: HTMLElement) => {
    const remaining = withoutKeyword(selected, keywordId);
    if (remaining.length === 0) {
      onClear();
      return;
    }
    const neighbour = survivingNeighbour(
      selection.effective,
      (candidate) => candidate === keywordId,
    );
    focusAfterCommit(
      neighbour === undefined
        ? null
        : document.getElementById(dynamicsChipId(neighbour)),
      trigger,
    );
    void setKeywords(remaining);
  };

  return (
    <div className="flex flex-col gap-3">
      <DynamicsChips
        selected={selection.effective}
        tracked={tracked}
        chart={chart}
        onRemove={removeChip}
      />
      {chart.checkedDays === 0 ? (
        everChecked ? (
          <NoDataInRange
            onWiden={range === WIDEST_RANGE ? undefined : onWiden}
          />
        ) : (
          <NoPositionsYet />
        )
      ) : chart.checkedDays < MIN_TREND_POINTS ? (
        <InsufficientHistory data={chart} />
      ) : (
        <RankingChart data={chart} changeDates={[...changeDays.keys()]} />
      )}
      {isCapped(selection) ? (
        <p className="text-caption text-muted-foreground">
          {cappingLine(selection)}
        </p>
      ) : null}
      {failedRead(changesRead) ? (
        <InlineQueryError
          message="Could not load the listing changes."
          read={changesRead}
        />
      ) : null}
    </div>
  );
}
