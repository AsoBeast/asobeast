import { createTranslator } from "next-intl";
import type { TrackedKeywordItem } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
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

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export function popularityEvidence(
  row: TrackedKeywordItem,
  t: MessageTranslator = english,
) {
  const value = scoreValue(row, "traffic");
  return {
    value,
    label: t("table.popularity"),
    metric: "popularity",
    provenance: row.scoreProvenance,
    details: popularitySignalLines(
      row.scoreSignals ?? null,
      row.scoreProvenance?.source,
      value,
      t,
    ),
    outdated: isScoreOutdated(row),
    floorAnswer: hasFloorAnswer(row),
  } as const;
}

export function difficultyEvidence(
  row: TrackedKeywordItem,
  t: MessageTranslator = english,
) {
  return {
    value: scoreValue(row, "difficulty"),
    label: t("table.difficulty"),
    metric: "difficulty",
    provenance: row.scoreProvenance,
    details: difficultySignalLines(row.scoreSignals ?? null, t),
    outdated: isScoreOutdated(row),
  } as const;
}

export function opportunityEvidence(
  row: TrackedKeywordItem,
  t: MessageTranslator = english,
) {
  return {
    value: scoreValue(row, "opportunity"),
    label: t("table.opportunity"),
    metric: "opportunity",
    emphasize: true,
    lowerConfidence: hasFloorAnswer(row),
    details: lowerConfidenceLines("opportunity", row.scoreSignals ?? null, t),
  } as const;
}
