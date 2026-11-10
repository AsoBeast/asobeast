"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { normalizeText } from "@asobeast/shared";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import {
  CHART_MARGIN,
  GRID_PROPS,
  SCORE_AXIS_PROPS,
} from "@/components/charts/theme";
import {
  directionOfKey,
  edgeDot,
  entryDot,
  neighbour,
} from "@/components/keywords/map/dot-navigation";
import {
  thresholdLines,
  zoneAreas,
} from "@/components/keywords/map/zone-layers";
import { ThresholdsPopover } from "@/components/keywords/map/ThresholdsPopover";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { ChartContainer } from "@/components/ui/chart";
import { formatCountry, formatNumber, storeLabel } from "@/lib/format";
import { useIsMobile } from "@/lib/use-is-mobile";
import {
  DotContext,
  InspectionDot,
  SelectedMark,
  type DotState,
} from "./InspectionDots";
import {
  drawOrder,
  labelledKeywords,
  NARROW_LABEL_SCALE,
  navDots,
  WIDE_LABEL_SCALE,
  type InspectionPoint,
  type Storefront,
} from "./inspection-map";

const SELECT_KEYS = new Set(["Enter", " "]);
const EDGE_KEYS: Readonly<Record<string, "first" | "last">> = {
  Home: "first",
  End: "last",
};

const KEYBOARD_HELP =
  "Arrow keys move to the nearest keyword, Home and End jump to the highest and lowest opportunity, Enter shows its inspection.";

const dotIn = (surface: HTMLElement | null, keywordId: string) =>
  surface?.querySelector<SVGGElement>(
    `[data-inspection-id="${CSS.escape(keywordId)}"]`,
  ) ?? null;

const keepUnless =
  (keywordId: string) =>
  (current: string | null): string | null =>
    current === keywordId ? null : current;

function EmptyMap({ storefront }: { storefront: Storefront }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-1 rounded-md border border-dashed px-6 text-center sm:h-[400px]">
      <p className="font-medium">Nothing on the map yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Inspect a keyword in {storeLabel(storefront.store)}{" "}
        {formatCountry(storefront.country)} and it lands here, placed by its
        popularity and difficulty.
      </p>
    </div>
  );
}

const isNavigationKey = (key: string): boolean =>
  directionOfKey(key) !== null || Object.hasOwn(EDGE_KEYS, key);

function nextDotId(
  points: readonly InspectionPoint[],
  from: string,
  key: string,
): string | null {
  const dots = navDots(points);
  const direction = directionOfKey(key);
  if (direction !== null) return neighbour(dots, from, direction);
  return Object.hasOwn(EDGE_KEYS, key) ? edgeDot(dots, EDGE_KEYS[key]) : null;
}

type RovingDot = Pick<
  DotState,
  "rovingId" | "focusedId" | "onFocus" | "onBlur" | "onKey"
>;

function useRovingDot(
  points: readonly InspectionPoint[],
  selectedKeywordId: string | null,
  onSelect: (point: InspectionPoint) => void,
  surfaceRef: RefObject<HTMLDivElement | null>,
): RovingDot {
  const [rovingId, setRovingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const has = (id: string | null): id is string =>
    id !== null && points.some((point) => point.keywordId === id);
  const fallback = has(selectedKeywordId)
    ? selectedKeywordId
    : entryDot(navDots(points));
  return {
    rovingId: has(rovingId) ? rovingId : fallback,
    focusedId,
    onFocus(point) {
      setRovingId(point.keywordId);
      setFocusedId(point.keywordId);
    },
    onBlur(point, element) {
      if (element.isConnected) setFocusedId(keepUnless(point.keywordId));
    },
    onKey(point, event) {
      if (SELECT_KEYS.has(event.key)) {
        event.preventDefault();
        onSelect(point);
        return;
      }
      if (!isNavigationKey(event.key)) return;
      event.preventDefault();
      const next = nextDotId(points, point.keywordId, event.key);
      if (next !== null) dotIn(surfaceRef.current, next)?.focus();
    },
  };
}

export function InspectionMap({
  points,
  storefront,
  selectedKeywordId,
  previewKeyword = null,
  onSelect,
  footer,
}: {
  points: readonly InspectionPoint[];
  storefront: Storefront;
  selectedKeywordId: string | null;
  previewKeyword?: string | null;
  onSelect: (point: InspectionPoint) => void;
  footer?: ReactNode;
}) {
  const { thresholds } = useZoneThresholds();
  const [freshSince] = useState(() => Date.now());
  const surfaceRef = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const narrow = useIsMobile();
  const roving = useRovingDot(points, selectedKeywordId, onSelect, surfaceRef);
  const ordered = drawOrder(points);
  const chosen = points.filter(
    (point) => point.keywordId === selectedKeywordId,
  );
  const state: DotState = {
    ...roving,
    selectedKeywordId,
    previewKeyword:
      previewKeyword === null ? null : normalizeText(previewKeyword),
    labelled: labelledKeywords(
      points,
      selectedKeywordId,
      narrow ? NARROW_LABEL_SCALE : WIDE_LABEL_SCALE,
    ),
    freshSince,
    onSelect,
  };

  return (
    <section
      aria-labelledby="inspection-map-title"
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-raised sm:p-6 xl:sticky xl:top-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="inspection-map-title" className="text-title">
            Keyword map
          </h2>
          <p className="text-sm text-muted-foreground">
            {`${storeLabel(storefront.store)} · ${formatCountry(storefront.country)} · ${formatNumber(points.length)} ${points.length === 1 ? "keyword" : "keywords"} inspected`}
          </p>
        </div>
        <ThresholdsPopover />
      </header>
      {points.length === 0 ? (
        <EmptyMap storefront={storefront} />
      ) : (
        <DotContext.Provider value={state}>
          <p id={helpId} className="sr-only">
            {KEYBOARD_HELP}
          </p>
          <ChartContainer
            ref={surfaceRef}
            config={{}}
            role="region"
            aria-label="Inspected keywords by difficulty and popularity"
            className="aspect-auto h-[300px] w-full sm:h-[420px]"
          >
            <ScatterChart
              accessibilityLayer
              role="group"
              tabIndex={-1}
              aria-label="Inspected keywords"
              aria-describedby={helpId}
              margin={{ ...CHART_MARGIN, right: 16, top: 12 }}
            >
              {zoneAreas({ thresholds, selected: null })}
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                {...SCORE_AXIS_PROPS}
                dataKey="difficulty"
                name="Difficulty"
                height={44}
                label={{
                  value: "Difficulty",
                  position: "insideBottom",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
              <YAxis
                {...SCORE_AXIS_PROPS}
                dataKey="popularity"
                name="Popularity"
                width={48}
                label={{
                  value: "Popularity",
                  angle: -90,
                  position: "insideLeft",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
              {thresholdLines(thresholds)}
              <Scatter
                data={ordered}
                shape={InspectionDot}
                isAnimationActive={false}
              />
              <Scatter
                data={chosen}
                shape={SelectedMark}
                isAnimationActive={false}
              />
            </ScatterChart>
          </ChartContainer>
        </DotContext.Provider>
      )}
      {footer}
    </section>
  );
}
