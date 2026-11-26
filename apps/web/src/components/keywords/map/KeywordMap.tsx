"use client";

import { useCallback, useId, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
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
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MessageTranslator } from "@/i18n/translator";
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

function unplottedCaption(count: number, t: MessageTranslator): string {
  return t("map.unplotted", { count });
}

function ShapeKey({
  points,
  t,
}: {
  points: readonly MapPoint[];
  t: MessageTranslator;
}) {
  const items = [
    {
      key: "ranked",
      ranked: true,
      floor: false,
      label: t("map.shapes.ranking"),
    },
    {
      key: "unranked",
      ranked: false,
      floor: false,
      label: t("map.shapes.notRanking"),
    },
    ...(points.some((point) => point.floor)
      ? [
          {
            key: "floor",
            ranked: false,
            floor: true,
            label: t("map.shapes.floor"),
          },
        ]
      : []),
  ];
  return (
    <ul
      aria-label={t("map.shapes.aria")}
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

function unscoredBody(count: number, t: MessageTranslator): string {
  return t("map.notices.unscored", { count });
}

function tooFewDetail(
  narrowed: boolean,
  plotted: number,
  t: MessageTranslator,
): string {
  return narrowed
    ? t("map.notices.filtered", { count: plotted })
    : t("map.notices.soFar", { count: plotted, minimum: MIN_TREND_POINTS });
}

function MapNotice({
  keywords,
  points,
  narrowed,
  onClearFilters,
  t,
}: {
  keywords: readonly TrackedKeywordItem[];
  points: readonly MapPoint[];
  narrowed: boolean;
  onClearFilters: () => void;
  t: MessageTranslator;
}) {
  const clearButton = (
    <Button variant="outline" size="sm" onClick={onClearFilters}>
      {t("map.notices.clear")}
    </Button>
  );
  const clear = narrowed ? clearButton : undefined;
  if (keywords.length === 0) {
    return (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title={t("map.notices.noMatch")}
        action={clearButton}
      />
    );
  }
  if (trendState(points.length) === "empty") {
    return narrowed ? (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title={t("map.notices.noScored")}
        body={unscoredBody(keywords.length, t)}
        action={clear}
      />
    ) : (
      <ChartNotice
        height={CHART_HEIGHT.hero}
        title={t("map.notices.nothing")}
        body={t("map.notices.nothingBody")}
      />
    );
  }
  return (
    <ChartNotice
      height={CHART_HEIGHT.hero}
      title={t("map.notices.tooFew")}
      body={t("map.notices.tooFewBody", {
        minimum: MIN_TREND_POINTS,
        detail: tooFewDetail(narrowed, points.length, t),
      })}
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
  const t = useTranslations("keywordInspector");
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
        <CardTitle asChild>
          <h3>{t("map.title")}</h3>
        </CardTitle>
        {ready ? (
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <ThresholdsPopover />
            <MapImageButtons
              chartRef={chartRef}
              appId={history.appId}
              store={history.store}
              market={market}
              today={today}
            />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ready ? (
          <>
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
                {unplottedCaption(unplotted, t)}
              </p>
            ) : null}
            <ShapeKey points={points} t={t} />
            <MapZoneTable counts={counts} thresholds={thresholds} />
            <p id={helpId} className="sr-only">
              {t("map.keyboardHelp")}
            </p>
          </>
        ) : (
          <MapNotice
            keywords={keywords}
            points={points}
            narrowed={narrowed}
            onClearFilters={onClearFilters}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
}
