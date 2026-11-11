import { ReferenceArea, ReferenceLine, type LabelProps } from "recharts";
import { THRESHOLD_LINE_PROPS } from "@/components/charts/theme";
import {
  isKeywordZone,
  KEYWORD_ZONES,
  ZONE_LABELS,
  type KeywordZone,
  type ZoneThresholds,
} from "@/lib/keyword-zones";

export const ZONE_FILLS: Record<KeywordZone, string> = {
  quickWins: "var(--success)",
  worthFighting: "var(--warning)",
  easyPickings: "var(--info)",
  lowPriority: "var(--muted-foreground)",
};

const ZONE_FILL_OPACITY = 0.08;
const SELECTED_FILL_OPACITY = 0.18;
const MIN_LABEL_WIDTH = 72;
const MIN_LABEL_HEIGHT = 20;
const LABEL_INSET = 6;
const LABEL_BASELINE = 14;
const THRESHOLD_LABEL_FLIP_FROM = 85;

const TOP_ZONES: ReadonlySet<KeywordZone> = new Set([
  "quickWins",
  "worthFighting",
]);
const LEFT_ZONES: ReadonlySet<KeywordZone> = new Set([
  "quickWins",
  "easyPickings",
]);

function zoneBounds(zone: KeywordZone, thresholds: ZoneThresholds) {
  const left = LEFT_ZONES.has(zone);
  const top = TOP_ZONES.has(zone);
  return {
    x1: left ? 0 : thresholds.difficulty,
    x2: left ? thresholds.difficulty : 100,
    y1: top ? thresholds.popularity : 0,
    y2: top ? 100 : thresholds.popularity,
  };
}

function ZoneLabel({ value, viewBox }: LabelProps) {
  if (
    !isKeywordZone(value) ||
    !viewBox ||
    !("height" in viewBox) ||
    viewBox.width < MIN_LABEL_WIDTH ||
    viewBox.height < MIN_LABEL_HEIGHT
  ) {
    return <g />;
  }
  const left = LEFT_ZONES.has(value);
  return (
    <text
      className="recharts-label"
      x={
        left ? viewBox.x + LABEL_INSET : viewBox.x + viewBox.width - LABEL_INSET
      }
      y={
        TOP_ZONES.has(value)
          ? viewBox.y + LABEL_BASELINE
          : viewBox.y + viewBox.height - LABEL_INSET
      }
      textAnchor={left ? "start" : "end"}
      fill="var(--muted-foreground)"
      fontSize={10}
    >
      {ZONE_LABELS[value]}
    </text>
  );
}

export function zoneAreas({
  thresholds,
  selected,
  onZone,
}: {
  thresholds: ZoneThresholds;
  selected: KeywordZone | null;
  onZone?: (zone: KeywordZone) => void;
}) {
  return KEYWORD_ZONES.map((zone) => (
    <ReferenceArea
      key={zone}
      {...zoneBounds(zone, thresholds)}
      fill={ZONE_FILLS[zone]}
      fillOpacity={
        zone === selected ? SELECTED_FILL_OPACITY : ZONE_FILL_OPACITY
      }
      ifOverflow="hidden"
      label={{ value: zone, content: ZoneLabel }}
      className={onZone ? `zone-${zone} cursor-pointer` : `zone-${zone}`}
      onClick={onZone ? () => onZone(zone) : undefined}
    />
  ));
}

const thresholdLabel = (
  value: string,
  position: "insideTopRight" | "insideBottomRight" | "insideBottomLeft",
) => ({ value, position, fill: "var(--muted-foreground)", fontSize: 10 });

export function thresholdLines(thresholds: ZoneThresholds) {
  const nearTop = thresholds.popularity >= THRESHOLD_LABEL_FLIP_FROM;
  const nearRight = thresholds.difficulty >= THRESHOLD_LABEL_FLIP_FROM;
  return [
    <ReferenceLine
      key="popularity"
      y={thresholds.popularity}
      {...THRESHOLD_LINE_PROPS}
      label={thresholdLabel(
        `Popularity ${thresholds.popularity}`,
        nearTop ? "insideTopRight" : "insideBottomRight",
      )}
    />,
    <ReferenceLine
      key="difficulty"
      x={thresholds.difficulty}
      {...THRESHOLD_LINE_PROPS}
      label={thresholdLabel(
        `Difficulty ${thresholds.difficulty}`,
        nearRight ? "insideBottomRight" : "insideBottomLeft",
      )}
    />,
  ];
}
