import { ReferenceArea } from "recharts";
import { RANK_DEPTH } from "@asobeast/shared";
import { RankBandLabel } from "./RankBandLabel";
import { seriesColor } from "./theme";

export const RANK_TICKS = [1, 10, 25, 50, 100, RANK_DEPTH];

const RANK_TIERS = [
  { from: 1, to: 3, opacity: 0.18 },
  { from: 3, to: 10, opacity: 0.13 },
  { from: 10, to: 25, opacity: 0.085 },
  { from: 25, to: 50, opacity: 0.05 },
  { from: 50, to: 100, opacity: 0.025 },
] as const;

const LABELLED_THROUGH = 25;

const UNRANKED_FROM = 100;

const CELL_STRENGTH = 190;

const tierName = (to: number) => `Top ${to}`;

const cellTint = (opacity: number) =>
  `color-mix(in srgb, ${seriesColor(0)} ${Math.round(opacity * CELL_STRENGTH)}%, transparent)`;

export const RANK_TIER_KEY = RANK_TIERS.map((tier) => ({
  label: tierName(tier.to),
  tint: cellTint(tier.opacity),
}));

export function rankTierTint(position: number): string | undefined {
  const tier = RANK_TIERS.find((candidate) => position <= candidate.to);
  return tier ? cellTint(tier.opacity) : undefined;
}

export function rankTierAreas() {
  return [
    <ReferenceArea
      key="unranked"
      y1={UNRANKED_FROM}
      y2={RANK_DEPTH}
      fill="var(--muted)"
      fillOpacity={0.6}
      ifOverflow="hidden"
    />,
    ...RANK_TIERS.map((tier) => (
      <ReferenceArea
        key={tier.to}
        y1={tier.from}
        y2={tier.to}
        fill={seriesColor(0)}
        fillOpacity={tier.opacity}
        ifOverflow="hidden"
        label={
          tier.to <= LABELLED_THROUGH
            ? { value: tierName(tier.to), content: RankBandLabel }
            : undefined
        }
      />
    )),
  ];
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
