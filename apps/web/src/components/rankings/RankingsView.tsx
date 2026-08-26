"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { keywordLabel } from "@asobeast/shared";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  changesOptions,
  keywordsOptions,
  rankingsOptions,
} from "@/lib/queries";
import { presetToRange, RANGE_PRESETS } from "@/lib/ranges";
import { keywordIdsParser, rangeParser } from "@/lib/search-params";
import { MIN_TREND_POINTS } from "@/components/charts/ChartStates";
import { exportRankings } from "./ranking-csv";
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

  const effective =
    selected.length > 0
      ? selected
      : topByOpportunity(tracked, DEFAULT_SELECTION);

  const bounds = presetToRange(range);
  const { data } = useSuspenseQuery(
    rankingsOptions(id, { ...bounds, keywordIds: effective }),
  );
  const { data: changes } = useQuery(
    changesOptions(id, Number(range.replace("d", ""))),
  );
  const changeDates = (changes?.events ?? [])
    .filter((event) => !event.isCompetitor)
    .map((event) => event.capturedAt.slice(0, 10));

  const widest = RANGE_PRESETS[RANGE_PRESETS.length - 1];
  const everChecked = tracked.some(
    (item) => effective.includes(item.keywordId) && item.latestDepth !== null,
  );

  const chart = buildRankingChart(data.series);
  const labels = new Map(
    tracked.map((item) => [item.keywordId, keywordLabel(item)]),
  );

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
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: chart.config[keywordId]?.color }}
              />
              <span className="max-w-40 truncate">
                {labels.get(keywordId) ?? keywordId}
              </span>
              <X className="size-3 opacity-60" aria-hidden />
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={chart.rows.length === 0}
            onClick={() => exportRankings(id, bounds, chart)}
            aria-label="Export rankings to CSV"
          >
            <Download />
            Export CSV
          </Button>
        </div>

        {tracked.length === 0 ? (
          <NoKeywordsTracked id={id} />
        ) : chart.rows.length === 0 ? (
          everChecked ? (
            <NoDataInRange
              onWiden={
                range === widest ? undefined : () => void setRange(widest)
              }
            />
          ) : (
            <NoPositionsYet />
          )
        ) : chart.rows.length < MIN_TREND_POINTS ? (
          <InsufficientHistory data={chart} />
        ) : (
          <>
            <RankingChart data={chart} changeDates={changeDates} />
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
