import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  hasFloorAnswer,
  isScoreOutdated,
  scoreValue,
} from "@/lib/keyword-scores";
import {
  difficultySignalLines,
  lowerConfidenceLines,
  popularitySignalLines,
} from "./score-signals";

export function popularityEvidence(row: TrackedKeywordItem) {
  const value = scoreValue(row, "traffic");
  return {
    value,
    label: "Popularity",
    metric: "popularity",
    provenance: row.scoreProvenance,
    details: popularitySignalLines(
      row.scoreSignals ?? null,
      row.scoreProvenance?.source,
      value,
    ),
    outdated: isScoreOutdated(row),
    floorAnswer: hasFloorAnswer(row),
  } as const;
}

export function difficultyEvidence(row: TrackedKeywordItem) {
  return {
    value: scoreValue(row, "difficulty"),
    label: "Difficulty",
    metric: "difficulty",
    provenance: row.scoreProvenance,
    details: difficultySignalLines(row.scoreSignals ?? null),
    outdated: isScoreOutdated(row),
  } as const;
}

export function opportunityEvidence(row: TrackedKeywordItem) {
  return {
    value: scoreValue(row, "opportunity"),
    label: "Opportunity",
    metric: "opportunity",
    emphasize: true,
    lowerConfidence: hasFloorAnswer(row),
    details: lowerConfidenceLines("opportunity", row.scoreSignals ?? null),
  } as const;
}
