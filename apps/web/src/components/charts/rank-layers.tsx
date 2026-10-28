import { ReferenceArea } from "recharts";
import { RANK_DEPTH } from "@asobeast/shared";
import { RankBandLabel } from "./RankBandLabel";

export const RANK_TICKS = [1, 10, 25, 50, 100, RANK_DEPTH];

export const RANK_TIERS = [
  { from: 1, to: 3, fill: "var(--rank-band-1)", label: "Top 3" },
  { from: 3, to: 10, fill: "var(--rank-band-2)", label: "Top 10" },
  { from: 10, to: 25, fill: "var(--rank-band-3)", label: "Top 25" },
] as const;

export function rankTierAreas() {
  return RANK_TIERS.map((tier) => (
    <ReferenceArea
      key={tier.label}
      y1={tier.from}
      y2={tier.to}
      fill={tier.fill}
      fillOpacity={0.08}
      ifOverflow="hidden"
      label={{ value: tier.label, content: RankBandLabel }}
    />
  ));
}

export const markerLineProps = (
  dataKey: string,
  seriesKey: string,
  fill: string,
) => ({
  dataKey,
  type: "monotone" as const,
  stroke: "transparent",
  legendType: "none" as const,
  connectNulls: false,
  isAnimationActive: false,
  activeDot: false as const,
  dot: { r: 3, fill, stroke: `var(--color-${seriesKey})`, strokeWidth: 1.5 },
});
