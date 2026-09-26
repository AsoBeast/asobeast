import { toDifficulty100, toVolume } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { grade, type Grade, type GradeMetric } from "@/lib/grade";

export type ComparisonScore = "traffic" | "difficulty";

export const UNNAMED_COMPETITOR = "Competitor";

const TO_DISPLAY_SCALE: Record<ComparisonScore, (score: number) => number> = {
  traffic: toVolume,
  difficulty: toDifficulty100,
};

const COMPARISON_SCORE_METRIC: Record<ComparisonScore, GradeMetric> = {
  traffic: "popularity",
  difficulty: "difficulty",
};

export function comparisonScoreValue(
  row: KeywordComparisonRow,
  score: ComparisonScore,
): number | null {
  const value = row[score];
  return value === null ? null : Math.round(TO_DISPLAY_SCALE[score](value));
}

export function comparisonScore(
  row: KeywordComparisonRow,
  score: ComparisonScore,
): { label: string; grade: Grade | null } {
  const shown = comparisonScoreValue(row, score);
  if (shown === null) return { label: "—", grade: null };
  return {
    label: String(shown),
    grade: grade(COMPARISON_SCORE_METRIC[score], shown),
  };
}
