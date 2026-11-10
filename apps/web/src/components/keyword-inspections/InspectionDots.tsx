"use client";

import { createContext, useContext, type KeyboardEvent } from "react";
import type { ScatterShapeProps } from "recharts";
import { seriesColor } from "@/components/charts/theme";
import {
  END_ANCHORED_FROM,
  pointName,
  type InspectionPoint,
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
export interface DotState {
  selectedKeywordId: string | null;
  previewKeyword: string | null;
  labelled: ReadonlySet<string>;
  freshSince: number;
  rovingId: string | null;
  focusedId: string | null;
  onSelect: (point: InspectionPoint) => void;
  onFocus: (point: InspectionPoint) => void;
  onBlur: (point: InspectionPoint, element: Element) => void;
  onKey: (point: InspectionPoint, event: KeyboardEvent<Element>) => void;
}

export const DotContext = createContext<DotState | null>(null);

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
    <g>
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

export function SelectedMark({ cx, cy, payload }: ScatterShapeProps) {
  if (cx === undefined || cy === undefined || !isPoint(payload)) return null;
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      aria-hidden
      pointerEvents="none"
      data-inspection-selected={payload.keyword}
    >
      <circle r={SELECTED_RING} fill="var(--card)" />
      <circle
        r={SELECTED_RING}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
      />
      <circle r={SELECTED_RADIUS} fill="var(--primary)" />
      <SelectedTag point={payload} />
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

export function InspectionDot({ cx, cy, payload }: ScatterShapeProps) {
  const state = useContext(DotContext);
  if (cx === undefined || cy === undefined || !isPoint(payload) || !state) {
    return null;
  }
  const selected = payload.keywordId === state.selectedKeywordId;
  const previewed = !selected && payload.keyword === state.previewKeyword;
  return (
    <g
      ref={(node) => {
        if (
          node !== null &&
          state.focusedId === payload.keywordId &&
          document.activeElement === document.body
        ) {
          node.focus();
        }
      }}
      transform={`translate(${cx} ${cy})`}
      role="button"
      tabIndex={state.rovingId === payload.keywordId ? 0 : -1}
      aria-label={pointName(payload)}
      aria-pressed={selected}
      data-inspection-id={payload.keywordId}
      data-inspection-keyword={payload.keyword}
      className="group cursor-pointer outline-none"
      onClick={() => state.onSelect(payload)}
      onFocus={() => state.onFocus(payload)}
      onBlur={(event) => state.onBlur(payload, event.currentTarget)}
      onKeyDown={(event) => state.onKey(payload, event)}
    >
      <circle r={HIT_RADIUS} fill="transparent" />
      <g
        className={
          isFresh(payload, state.freshSince)
            ? "origin-center [transform-box:fill-box] motion-safe:animate-in motion-safe:zoom-in-0 motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out"
            : undefined
        }
      >
        {selected ? null : (
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
      {!selected && (previewed || state.labelled.has(payload.keywordId)) ? (
        <DotLabel point={payload} strong={previewed} />
      ) : null}
    </g>
  );
}
