import { toDifficulty100, toVolume } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";
import { grade, type Grade, type GradeMetric } from "@/lib/grade";

export type ComparisonScore = "traffic" | "difficulty";

const TO_DISPLAY_SCALE: Record<ComparisonScore, (score: number) => number> = {
  traffic: toVolume,
  difficulty: toDifficulty100,
};

const COMPARISON_SCORE_METRIC: Record<ComparisonScore, GradeMetric> = {
  traffic: "popularity",
  difficulty: "difficulty",
};

export function comparisonScore(
  row: KeywordComparisonRow,
  score: ComparisonScore,
): { label: string; grade: Grade | null } {
  const value = row[score];
  if (value === null) return { label: "—", grade: null };
  const shown = Math.round(TO_DISPLAY_SCALE[score](value));
  return {
    label: String(shown),
    grade: grade(COMPARISON_SCORE_METRIC[score], shown),
  };
}
