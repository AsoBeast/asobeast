import { toDifficulty100, toVolume } from "@asobeast/shared";
import type { KeywordComparisonRow } from "@asobeast/shared";

type ComparisonScore = "traffic" | "difficulty";

const TO_DISPLAY_SCALE: Record<ComparisonScore, (score: number) => number> = {
  traffic: toVolume,
  difficulty: toDifficulty100,
};

export function comparisonScoreLabel(
  row: KeywordComparisonRow,
  score: ComparisonScore,
): string {
  const value = row[score];
  return value === null
    ? "—"
    : String(Math.round(TO_DISPLAY_SCALE[score](value)));
}
