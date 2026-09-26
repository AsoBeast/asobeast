import { formatRankPosition } from "@asobeast/shared";
import type {
  KeywordComparisonCompetitor,
  KeywordComparisonRow,
} from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { versusOf } from "@/lib/table/facets";
import { comparisonScoreValue, UNNAMED_COMPETITOR } from "./comparison-scores";

const LEADING_HEADERS = ["keyword", "popularity", "difficulty", "you"];
const TRAILING_HEADERS = ["result", "gap"];

function competitorHeaders(
  competitors: readonly KeywordComparisonCompetitor[],
): string[] {
  const taken = new Set([...LEADING_HEADERS, ...TRAILING_HEADERS]);
  return competitors.map(({ name }) => {
    const base = name ?? UNNAMED_COMPETITOR;
    let header = base;
    for (let copy = 2; taken.has(header); copy += 1) {
      header = `${base} (${copy})`;
    }
    taken.add(header);
    return header;
  });
}

export function comparisonCsv(
  competitors: readonly KeywordComparisonCompetitor[],
  rows: readonly KeywordComparisonRow[],
): string {
  return toCsv(
    [
      ...LEADING_HEADERS,
      ...competitorHeaders(competitors),
      ...TRAILING_HEADERS,
    ],
    rows.map((row) => {
      const positions = competitors.map(({ id }) => row.positions[id] ?? null);
      return [
        row.text,
        comparisonScoreValue(row, "traffic"),
        comparisonScoreValue(row, "difficulty"),
        formatRankPosition(row.you),
        ...positions.map((position) => formatRankPosition(position)),
        versusOf(row.you, positions),
        row.gap ? "true" : "false",
      ];
    }),
  );
}

export function comparisonFilename(appId: string, onlyGaps: boolean): string {
  return csvFilename(onlyGaps ? "keyword-gaps" : "keyword-comparison", appId);
}

export function exportComparison(
  appId: string,
  onlyGaps: boolean,
  competitors: readonly KeywordComparisonCompetitor[],
  rows: readonly KeywordComparisonRow[],
): void {
  downloadCsv(
    comparisonFilename(appId, onlyGaps),
    comparisonCsv(competitors, rows),
  );
}
