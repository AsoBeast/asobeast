import type { KeywordComparisonRow } from "@asobeast/shared";

export function comparisonScoreLabel(
  row: KeywordComparisonRow,
  score: "traffic" | "difficulty",
): string {
  const value = row[score];
  return value === null ? "—" : String(Math.round(value * 10));
}
