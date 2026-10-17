import type { LabelProps } from "recharts";

const MIN_BAND_HEIGHT = 14;
const RIGHT_INSET = 4;
const BASELINE = 11;

export function RankBandLabel({ value, viewBox }: LabelProps) {
  if (!viewBox || !("height" in viewBox) || viewBox.height < MIN_BAND_HEIGHT) {
    return <g />;
  }
  return (
    <text
      className="recharts-label"
      x={viewBox.x + viewBox.width - RIGHT_INSET}
      y={viewBox.y + BASELINE}
      textAnchor="end"
      fill="var(--muted-foreground)"
      fontSize={10}
    >
      {String(value)}
    </text>
  );
}
