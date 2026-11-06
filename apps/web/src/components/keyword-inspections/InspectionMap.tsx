"use client";

import {
  createContext,
  useContext,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  type ScatterShapeProps,
} from "recharts";
import {
  CHART_MARGIN,
  GRID_PROPS,
  SCORE_AXIS_PROPS,
  seriesColor,
} from "@/components/charts/theme";
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
  END_ANCHORED_FROM,
  labelledKeywords,
  NARROW_LABEL_SCALE,
  WIDE_LABEL_SCALE,
  pointName,
  type InspectionPoint,
  type Storefront,
} from "./inspection-map";

const DOT_RADIUS = 5;
const SELECTED_RADIUS = 6;
const SELECTED_RING = 11;
const PREVIEW_RING = 9;
const TAG_CHAR_WIDTH = 7;
const TAG_PADDING = 6;
const TAG_HEIGHT = 20;
const HIT_RADIUS = 14;
const FOCUS_RADIUS = 10;
const LABEL_OFFSET = 11;
const LABEL_BASELINE = 4;

interface DotState {
  selectedKeywordId: string | null;
  previewKeyword: string | null;
  labelled: ReadonlySet<string>;
  freshSince: number;
  onSelect: (point: InspectionPoint) => void;
}

const DotContext = createContext<DotState | null>(null);

function isPoint(value: unknown): value is InspectionPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "keywordId") === "string" &&
    typeof Reflect.get(value, "keyword") === "string"
  );
}

const isFresh = (point: InspectionPoint, since: number): boolean =>
  point.completedAt !== null && Date.parse(point.completedAt) > since;

function SelectedTag({ point }: { point: InspectionPoint }) {
  const endAnchored = point.difficulty >= END_ANCHORED_FROM;
  const width = point.keyword.length * TAG_CHAR_WIDTH + TAG_PADDING * 2;
  const offset = SELECTED_RING + 6;
  const x = endAnchored ? -offset - width : offset;
  return (
    <g aria-hidden>
      <rect
        x={x}
        y={-TAG_HEIGHT / 2}
        width={width}
        height={TAG_HEIGHT}
        rx={4}
        fill="var(--foreground)"
      />
      <text
        x={x + TAG_PADDING}
        y={LABEL_BASELINE}
        fontSize={12}
        fontWeight={600}
        fill="var(--background)"
      >
        {point.keyword}
      </text>
    </g>
  );
}

function DotLabel({
  point,
  strong,
}: {
  point: InspectionPoint;
  strong: boolean;
}) {
  const endAnchored = point.difficulty >= END_ANCHORED_FROM;
  const placement = {
    x: endAnchored ? -LABEL_OFFSET : LABEL_OFFSET,
    y: LABEL_BASELINE,
    textAnchor: endAnchored ? "end" : "start",
    fontSize: 11,
    fontWeight: strong ? 600 : 400,
  } as const;
  return (
    <g aria-hidden>
      <text
        {...placement}
        fill="var(--card)"
        stroke="var(--card)"
        strokeWidth={4}
        strokeLinejoin="round"
      >
        {point.keyword}
      </text>
      <text {...placement} fill="var(--foreground)">
        {point.keyword}
      </text>
    </g>
  );
}

function InspectionDot({ cx, cy, payload }: ScatterShapeProps) {
  const state = useContext(DotContext);
  if (cx === undefined || cy === undefined || !isPoint(payload) || !state) {
    return null;
  }
  const selected = payload.keywordId === state.selectedKeywordId;
  const previewed = !selected && payload.keyword === state.previewKeyword;
  const choose = () => state.onSelect(payload);
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose();
    }
  };
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      role="button"
      tabIndex={0}
      aria-label={pointName(payload)}
      aria-pressed={selected}
      data-inspection-keyword={payload.keyword}
      className="group cursor-pointer outline-none"
      onClick={choose}
      onKeyDown={onKeyDown}
    >
      <circle r={HIT_RADIUS} fill="transparent" />
      <g
        className={
          isFresh(payload, state.freshSince)
            ? "origin-center [transform-box:fill-box] motion-safe:animate-in motion-safe:zoom-in-0 motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out"
            : undefined
        }
      >
        {selected ? (
          <>
            <circle r={SELECTED_RING} fill="var(--card)" />
            <circle
              r={SELECTED_RING}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2.5}
            />
            <circle r={SELECTED_RADIUS} fill="var(--primary)" />
          </>
        ) : (
          <circle
            r={DOT_RADIUS}
            fill={seriesColor(0)}
            stroke="var(--card)"
            strokeWidth={1.5}
            className="transition-[r] duration-150 group-hover:[r:7px]"
          />
        )}
        {previewed ? (
          <circle
            r={PREVIEW_RING}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2}
          />
        ) : null}
      </g>
      <circle
        r={FOCUS_RADIUS + (selected ? 6 : 0)}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={2}
        className="opacity-0 group-focus-visible:opacity-100"
      />
      {selected ? <SelectedTag point={payload} /> : null}
      {!selected && (previewed || state.labelled.has(payload.keywordId)) ? (
        <DotLabel point={payload} strong={previewed} />
      ) : null}
    </g>
  );
}

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
  const narrow = useIsMobile();
  const others = points.filter(
    (point) => point.keywordId !== selectedKeywordId,
  );
  const chosen = points.filter(
    (point) => point.keywordId === selectedKeywordId,
  );
  const state: DotState = {
    selectedKeywordId,
    previewKeyword,
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
            {storeLabel(storefront.store)} · {formatCountry(storefront.country)}{" "}
            · {formatNumber(points.length)}{" "}
            {points.length === 1 ? "keyword" : "keywords"} inspected
          </p>
        </div>
        <ThresholdsPopover />
      </header>
      {points.length === 0 ? (
        <EmptyMap storefront={storefront} />
      ) : (
        <DotContext.Provider value={state}>
          <ChartContainer
            config={{}}
            role="region"
            aria-label="Inspected keywords by difficulty and popularity"
            className="aspect-auto h-[300px] w-full sm:h-[420px]"
          >
            <ScatterChart margin={{ ...CHART_MARGIN, right: 16, top: 12 }}>
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
                data={others}
                shape={InspectionDot}
                isAnimationActive={false}
              />
              <Scatter
                data={chosen}
                shape={InspectionDot}
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
