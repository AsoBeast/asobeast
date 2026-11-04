"use client";

import { useId, useMemo } from "react";
import { useQueryState } from "nuqs";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { ChartNotice, trendState } from "@/components/charts/ChartStates";
import { CHART_HEIGHT } from "@/components/charts/theme";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { keywordZoneParser } from "@/lib/search-params";
import { useZoneThresholds } from "../use-zone-thresholds";
import { KeywordMapChart } from "./KeywordMapChart";
import { mapPoints, type MapPoint } from "./map-points";
import { DotGlyph } from "./MapDot";

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

function MapBody({
  keywords,
  onClearFilters,
}: {
  keywords: readonly TrackedKeywordItem[];
  onClearFilters: () => void;
}) {
  const helpId = useId();
  const { thresholds } = useZoneThresholds();
  const [zone] = useQueryState("zone", keywordZoneParser);
  const { points, unplotted } = useMemo(
    () => mapPoints(keywords, thresholds),
    [keywords, thresholds],
  );

  if (keywords.length === 0) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="No keywords match these filters"
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }
  const state = trendState(points.length);
  if (state === "empty") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="Nothing to map yet"
        body="No tracked keyword has both a popularity and a difficulty yet. Scores arrive with the weekly scoring run."
      />
    );
  }
  if (state === "insufficient") {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title="Too few scored keywords"
        body={`The map needs at least 4 keywords with both scores. ${points.length} of 4 so far.`}
      />
    );
  }
  return (
    <>
      <KeywordMapChart
        points={points}
        thresholds={thresholds}
        zone={zone}
        describedBy={helpId}
      />
      {unplotted > 0 ? (
        <p className="text-caption text-muted-foreground">
          {unplottedCaption(unplotted)}
        </p>
      ) : null}
      <ShapeKey points={points} />
      <p id={helpId} className="sr-only">
        {KEYBOARD_HELP}
      </p>
    </>
  );
}

export function KeywordMap({
  keywords,
  onClearFilters,
}: {
  keywords: readonly TrackedKeywordItem[];
  onClearFilters: () => void;
}) {
  return (
    <Card className="print:break-inside-avoid">
      <CardHeader>
        <CardDescription>Opportunity map</CardDescription>
        <CardTitle>Popularity by difficulty</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MapBody keywords={keywords} onClearFilters={onClearFilters} />
      </CardContent>
    </Card>
  );
}
