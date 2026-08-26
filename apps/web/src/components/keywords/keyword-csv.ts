import { formatCheckedPosition } from "@asobeast/shared";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { scoreValue } from "./keyword-cells";

const SCORE_COMPARABILITY =
  "Apple App Store and Google Play traffic and volume scores use different public signals and are not directly comparable";

const KEYWORD_CSV_HEADERS = [
  "keyword",
  "source",
  "active",
  "position",
  "delta1d",
  "delta7d",
  "volatility",
  "traffic",
  "difficulty",
  "opportunity",
  "bucket",
  "relevance",
  "scoredAt",
  "scoringSource",
  "formulaVersion",
  "confidence",
  "capturedAt",
  "scoreComparability",
];

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

export function keywordCsv(rows: TrackedKeywordItem[]): string {
  const csvRows = rows.map((keyword) => [
    keyword.text,
    keyword.source,
    keyword.active ? "true" : "false",
    formatCheckedPosition(keyword.latestPosition, keyword.latestDepth),
    keyword.positionDelta1d,
    keyword.positionDelta7d,
    keyword.serpVolatility7d,
    roundOrNull(scoreValue(keyword, "traffic")),
    roundOrNull(scoreValue(keyword, "difficulty")),
    roundOrNull(keyword.opportunity),
    keyword.bucket,
    keyword.relevance,
    keyword.scoredAt,
    keyword.scoreProvenance?.source ?? null,
    keyword.scoreProvenance?.formulaVersion ?? null,
    keyword.scoreProvenance?.confidence ?? null,
    keyword.scoreProvenance?.capturedAt ?? null,
    SCORE_COMPARABILITY,
  ]);
  return toCsv(KEYWORD_CSV_HEADERS, csvRows);
}

export function exportKeywords(
  appId: string,
  rows: TrackedKeywordItem[],
): void {
  downloadCsv(csvFilename("keywords", appId), keywordCsv(rows));
}
