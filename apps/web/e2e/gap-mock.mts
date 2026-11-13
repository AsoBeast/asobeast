import type { CompetitorAnalysis, VisibilityHistory } from "@asobeast/shared";
import {
  COMPETITOR_GAP_STATES,
  CROWDED_ANALYSIS,
} from "./competitors-fixtures.mts";
import {
  APP_1_VISIBILITY_COMPARE_SHORT,
  EMPTY_ANALYSIS,
  GAP_STATES,
  utcDaysAgo,
  type AppDataset,
} from "./fixtures.mts";

const SHORT_RANGE_DAYS = 3;

export function analysisOf(
  dataset: AppDataset,
  gapState: string | undefined,
  crowded = false,
): CompetitorAnalysis {
  const state =
    gapState === undefined
      ? undefined
      : (GAP_STATES[gapState] ?? COMPETITOR_GAP_STATES[gapState]);
  if (state === undefined && crowded) return CROWDED_ANALYSIS;
  return state ?? dataset.competitorAnalysis ?? EMPTY_ANALYSIS;
}

export function visibilityComparedFor(
  dataset: AppDataset,
  query: URLSearchParams,
): VisibilityHistory {
  const from = query.get("from");
  if (!dataset.visibilityCompare || query.get("country")) {
    return { ...dataset.visibility, shareOfVoice: [] };
  }
  if (from !== null && from >= utcDaysAgo(SHORT_RANGE_DAYS - 1)) {
    return APP_1_VISIBILITY_COMPARE_SHORT;
  }
  return dataset.visibilityCompare;
}
