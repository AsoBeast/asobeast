"use client";

import { useCallback, useId, useMemo, useRef } from "react";
import { useQueryState } from "nuqs";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  ChartNotice,
  MIN_TREND_POINTS,
  trendState,
} from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { zoneCounts, type KeywordZone } from "@/lib/keyword-zones";
import { keywordZoneParser } from "@/lib/search-params";
import { scorePair } from "@/lib/keyword-scores";
import type { PositionHistoryContext } from "../PositionHistoryPopover";
import { useZoneThresholds } from "../use-zone-thresholds";
import { KeywordMapChart } from "./KeywordMapChart";
import { mapPoints, type MapPoint } from "./map-points";
import { DotGlyph } from "./MapDot";
import { MapImageButtons } from "./MapImageButtons";
import { MapSurface } from "./MapSurface";
import { MapZoneLegend, MapZoneTable } from "./MapZoneLegend";
import { ThresholdsPopover } from "./ThresholdsPopover";

const KEYBOARD_HELP =
  "Tab moves to the dots. Arrow keys move to the nearest dot, Home and End jump to the highest and lowest opportunity, Enter opens the position history.";

function unplottedCaption(count: number): string {
  return count === 1
    ? "1 keyword without both scores is not on the map."
    : `${count} keywords without both scores are not on the map.`;
}

function ShapeKey({ points }: { points: readonly MapPoint[] }) {
  const items = [
    { key: "ranked", ranked: true, floor: false, label: "Ranking" },
    { key: "unranked", ranked: false, floor: false, label: "Not ranking" },
    ...(points.some((point) => point.floor)
      ? [
          {
            key: "floor",
            ranked: false,
            floor: true,
            label: "Popularity at Apple's floor",
          },
        ]
      : []),
  ];
  return (
    <ul
      aria-label="Dot shapes"
      className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground"
    >
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14">
            <DotGlyph ranked={item.ranked} floor={item.floor} />
          </svg>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function unscoredBody(count: number): string {
  return count === 1
    ? "1 keyword matches these filters, and it does not have both a popularity and a difficulty."
    : `${count} keywords match these filters, and none has both a popularity and a difficulty.`;
}

function tooFewDetail(narrowed: boolean, plotted: number): string {
  return narrowed
    ? `These filters leave ${plotted}.`
    : `${plotted} of ${MIN_TREND_POINTS} so far.`;
}

function MapNotice({
  keywords,
  points,
  narrowed,
  onClearFilters,
}: {
  keywords: readonly TrackedKeywordItem[];
  points: readonly MapPoint[];
  narrowed: boolean;
  onClearFilters: () => void;
}) {
  const clearButton = (
    <Button variant="outline" size="sm" onClick={onClearFilters}>
      Clear filters
    </Button>
  );
  const clear = narrowed ? clearButton : undefined;
  if (keywords.length === 0) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="No keywords match these filters"
        action={clearButton}
      />
    );
  }
  if (trendState(points.length) === "empty") {
    return narrowed ? (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="No scored keywords match these filters"
        body={unscoredBody(keywords.length)}
        action={clear}
      />
    ) : (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="Nothing to map yet"
        body="No tracked keyword has both a popularity and a difficulty yet. Scores arrive with the weekly scoring run."
      />
    );
  }
  return (
    <ChartNotice
      height={CHART_HEIGHT.hero}
      title="Too few scored keywords"
      body={`The map needs at least ${MIN_TREND_POINTS} keywords with both scores. ${tooFewDetail(narrowed, points.length)}`}
      action={clear}
    />
  );
}

export function KeywordMap({
  keywords,
  narrowed,
  history,
  market,
  today,
  onClearFilters,
}: {
  keywords: readonly TrackedKeywordItem[];
  narrowed: boolean;
  history: PositionHistoryContext;
  market: string;
  today: string;
  onClearFilters: () => void;
}) {
  const helpId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const { thresholds } = useZoneThresholds();
  const [zone, setZone] = useQueryState("zone", keywordZoneParser);
  const { points, unplotted } = useMemo(
    () => mapPoints(keywords, thresholds),
    [keywords, thresholds],
  );
  const counts = useMemo(
    () => zoneCounts(keywords.map(scorePair), thresholds),
    [keywords, thresholds],
  );
  const keywordsById = useMemo(
    () => new Map(keywords.map((keyword) => [keyword.keywordId, keyword])),
    [keywords],
  );
  const ready = keywords.length > 0 && trendState(points.length) === "ready";
  const toggleZone = useCallback(
    (pressed: KeywordZone) =>
      void setZone((current) => (current === pressed ? null : pressed)),
    [setZone],
  );

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader>
        <CardDescription>Opportunity map</CardDescription>
        <CardTitle>Popularity by difficulty</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ready ? (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ThresholdsPopover />
              <MapImageButtons
                chartRef={chartRef}
                appId={history.appId}
                store={history.store}
                market={market}
                today={today}
              />
            </div>
            <MapZoneLegend
              counts={counts}
              thresholds={thresholds}
              selected={zone}
              onToggle={toggleZone}
            />
            <MapSurface
              points={points}
              zone={zone}
              keywords={keywordsById}
              history={history}
              today={today}
            >
              <KeywordMapChart
                points={points}
                thresholds={thresholds}
                zone={zone}
                describedBy={helpId}
                onZone={toggleZone}
                chartRef={chartRef}
              />
            </MapSurface>
            {unplotted > 0 ? (
              <p className="text-caption text-muted-foreground">
                {unplottedCaption(unplotted)}
              </p>
            ) : null}
            <ShapeKey points={points} />
            <MapZoneTable counts={counts} thresholds={thresholds} />
            <p id={helpId} className="sr-only">
              {KEYBOARD_HELP}
            </p>
          </>
        ) : (
          <MapNotice
            keywords={keywords}
            points={points}
            narrowed={narrowed}
            onClearFilters={onClearFilters}
          />
        )}
      </CardContent>
    </Card>
  );
}
