import type { RankDistribution, RankDistributionPoint } from "@asobeast/shared";

export type BandCounts = Omit<RankDistributionPoint, "date">;

export const RANK_BANDS = [
  {
    key: "rank1",
    label: "#1",
    color: "var(--rank-band-1)",
    fill: "bg-rank-band-1",
  },
  {
    key: "rank2to3",
    label: "#2–3",
    color: "var(--rank-band-2)",
    fill: "bg-rank-band-2",
  },
  {
    key: "rank4to10",
    label: "#4–10",
    color: "var(--rank-band-3)",
    fill: "bg-rank-band-3",
  },
  {
    key: "rank11to50",
    label: "#11–50",
    color: "var(--rank-band-4)",
    fill: "bg-rank-band-4",
  },
  {
    key: "rank51plus",
    label: "#51+",
    color: "var(--rank-band-5)",
    fill: "bg-rank-band-5",
  },
] as const;

export const UNRANKED_BAND = {
  key: "unranked",
  label: "Unranked",
  color: "var(--muted-foreground)",
  fill: "bg-muted",
} as const;

const ALL_BANDS = [...RANK_BANDS, UNRANKED_BAND];

export interface BandSegment {
  key: keyof BandCounts;
  label: string;
  fill: string;
  count: number;
  share: number;
}

export function bandCounts(distribution: RankDistribution): BandCounts {
  return {
    rank1: distribution.top1,
    rank2to3: distribution.top3 - distribution.top1,
    rank4to10: distribution.top10 - distribution.top3,
    rank11to50: distribution.top50 - distribution.top10,
    rank51plus: distribution.beyond,
    unranked: distribution.unranked,
  };
}

export function bandSegments(distribution: RankDistribution): BandSegment[] {
  const counts = bandCounts(distribution);
  const total = ALL_BANDS.reduce((sum, band) => sum + counts[band.key], 0);
  if (total === 0) return [];
  return ALL_BANDS.filter((band) => counts[band.key] > 0).map((band) => ({
    key: band.key,
    label: band.label,
    fill: band.fill,
    count: counts[band.key],
    share: counts[band.key] / total,
  }));
}

export function bandSummary(distribution: RankDistribution): string {
  const counts = bandCounts(distribution);
  const ranked = RANK_BANDS.map(
    (band) => `${counts[band.key]} at ${band.label}`,
  );
  return `Rank bands: ${[...ranked, `${counts.unranked} unranked`].join(", ")}`;
}
