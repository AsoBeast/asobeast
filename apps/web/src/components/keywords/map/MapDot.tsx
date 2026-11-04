"use client";

import { createContext, useContext } from "react";
import type { ScatterShapeProps } from "recharts";
import { seriesColor } from "@/components/charts/theme";
import { isKeywordZone, type KeywordZone } from "@/lib/keyword-zones";
import { dotLabel, type MapPoint } from "./map-points";

const DOT_RADIUS = 5;
const DIAMOND_PATH = "M 0 -7 L 7 0 L 0 7 L -7 0 Z";
const HIT_RADIUS = 12;
const DIMMED_OPACITY = 0.3;
const LABEL_OFFSET = 9;
const LABEL_BASELINE = 4;
const END_ANCHORED_FROM = 80;

export interface MapDotStateValue {
  chosenZone: KeywordZone | null;
  labelled: ReadonlySet<string>;
}

export const MapDotState = createContext<MapDotStateValue>({
  chosenZone: null,
  labelled: new Set(),
});

export function DotGlyph({
  ranked,
  floor,
}: {
  ranked: boolean;
  floor: boolean;
}) {
  const stroke = seriesColor(0);
  const fill = ranked ? stroke : "var(--card)";
  return floor ? (
    <path d={DIAMOND_PATH} fill={fill} stroke={stroke} strokeWidth={2} />
  ) : (
    <circle r={DOT_RADIUS} fill={fill} stroke={stroke} strokeWidth={2} />
  );
}

function isMapPoint(value: unknown): value is MapPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "keywordId") === "string" &&
    isKeywordZone(Reflect.get(value, "zone"))
  );
}

function DotLabel({ point }: { point: MapPoint }) {
  const endAnchored = point.difficulty >= END_ANCHORED_FROM;
  const text = dotLabel(point.text);
  const placement = {
    x: endAnchored ? -LABEL_OFFSET : LABEL_OFFSET,
    y: LABEL_BASELINE,
    textAnchor: endAnchored ? "end" : "start",
    fontSize: 10,
  } as const;
  return (
    <g data-map-label={point.text} aria-hidden>
      <text
        {...placement}
        fill="var(--card)"
        stroke="var(--card)"
        strokeWidth={3}
        strokeLinejoin="round"
      >
        {text}
      </text>
      <text {...placement} fill="var(--foreground)">
        {text}
      </text>
    </g>
  );
}

export function MapDotShape({ cx, cy, payload }: ScatterShapeProps) {
  const { chosenZone, labelled } = useContext(MapDotState);
  if (cx === undefined || cy === undefined || !isMapPoint(payload)) {
    return null;
  }
  const dimmed = chosenZone !== null && payload.zone !== chosenZone;
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      data-map-keyword={payload.keywordId}
      data-rank={payload.ranked ? "ranked" : "unranked"}
      data-shape={payload.floor ? "diamond" : "circle"}
      data-zone={payload.zone}
      data-dimmed={dimmed ? "true" : undefined}
      opacity={dimmed ? DIMMED_OPACITY : 1}
    >
      <circle r={HIT_RADIUS} fill="transparent" />
      <DotGlyph ranked={payload.ranked} floor={payload.floor} />
      {labelled.has(payload.keywordId) ? <DotLabel point={payload} /> : null}
    </g>
  );
}
