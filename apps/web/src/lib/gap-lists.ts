import type {
  CompetitorGapCoverage,
  CompetitorGapKeyword,
  CompetitorGaps,
} from "@asobeast/shared";

export const GAP_TABS = ["gaps", "winnable", "threats", "lead"] as const;

export type GapTab = (typeof GAP_TABS)[number];

export const GAP_TAB_LISTS = {
  gaps: "keywordGaps",
  winnable: "winnable",
  threats: "threats",
  lead: "lead",
} as const satisfies Record<GapTab, keyof CompetitorGaps>;

export const GAP_TAB_LABELS: Record<GapTab, string> = {
  gaps: "Keyword gaps",
  winnable: "Winnable now",
  threats: "Threats",
  lead: "You lead",
};

export const GAP_TAB_SUBJECTS: Record<GapTab, string> = {
  gaps: "keyword gaps",
  winnable: "winnable keywords",
  threats: "threats",
  lead: "keywords you lead",
};

export type GapEmpty = "none" | "noCompetitors" | "allDelisted" | "notCompared";

export function gapRows(
  gaps: CompetitorGaps,
  tab: GapTab,
  country: string,
  home: string,
): CompetitorGapKeyword[] {
  const rows = gaps[GAP_TAB_LISTS[tab]] ?? [];
  return country === ""
    ? rows
    : rows.filter((row) => (row.country ?? home) === country);
}

export function gapCounts(
  gaps: CompetitorGaps,
  country: string,
  home: string,
): Record<GapTab, number> {
  return {
    gaps: gapRows(gaps, "gaps", country, home).length,
    winnable: gapRows(gaps, "winnable", country, home).length,
    threats: gapRows(gaps, "threats", country, home).length,
    lead: gapRows(gaps, "lead", country, home).length,
  };
}

export function gapEmpty(
  coverage: CompetitorGapCoverage | undefined,
  country: string,
): GapEmpty {
  if (coverage === undefined) return "none";
  if (coverage.competitors === 0) {
    return coverage.delisted === 0 ? "noCompetitors" : "allDelisted";
  }
  const markets =
    country === ""
      ? coverage.markets
      : coverage.markets.filter((market) => market.country === country);
  return markets.some((market) => market.compared > 0) ? "none" : "notCompared";
}
