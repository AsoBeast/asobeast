import { formatRankPosition } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import type {
  KeywordComparisonCompetitor,
  KeywordComparisonRow,
} from "@asobeast/shared";
import enCompetitors from "../../../messages/en/competitors.json";
import type { MessageTranslator } from "@/i18n/translator";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { versusOf } from "@/lib/table/facets";
import { isChecked } from "./comparison-checks";
import { comparisonScoreValue } from "./comparison-scores";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

function competitorHeaders(
  competitors: readonly KeywordComparisonCompetitor[],
  t: MessageTranslator,
): string[] {
  const leading = [
    t("csv.keyword"),
    t("csv.popularity"),
    t("csv.difficulty"),
    t("csv.you"),
  ];
  const trailing = [t("csv.result"), t("csv.gap"), t("csv.country")];
  const taken = new Set([...leading, ...trailing]);
  return competitors.map(({ name }) => {
    const base = name ?? t("unnamed");
    let header = base;
    for (let copy = 2; taken.has(header); copy += 1) {
      header = `${base} (${copy})`;
    }
    taken.add(header);
    return header;
  });
}

function positionCell(
  row: KeywordComparisonRow,
  appId: string,
  position: number | null | undefined,
): string {
  return isChecked(row, appId) ? formatRankPosition(position) : "";
}

export function comparisonCsv(
  competitors: readonly KeywordComparisonCompetitor[],
  rows: readonly KeywordComparisonRow[],
  appId: string,
  t: MessageTranslator = english,
): string {
  const leading = [
    t("csv.keyword"),
    t("csv.popularity"),
    t("csv.difficulty"),
    t("csv.you"),
  ];
  const trailing = [t("csv.result"), t("csv.gap"), t("csv.country")];
  return toCsv(
    [...leading, ...competitorHeaders(competitors, t), ...trailing],
    rows.map((row) => {
      const positions = competitors.map(({ id }) => row.positions[id] ?? null);
      return [
        row.text,
        comparisonScoreValue(row, "traffic"),
        comparisonScoreValue(row, "difficulty"),
        positionCell(row, appId, row.you),
        ...competitors.map(({ id }, index) =>
          positionCell(row, id, positions[index]),
        ),
        versusOf(row.you, positions),
        row.gap ? "true" : "false",
        row.country,
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
  data: {
    competitors: readonly KeywordComparisonCompetitor[];
    rows: readonly KeywordComparisonRow[];
  },
  t: MessageTranslator = english,
): void {
  downloadCsv(
    comparisonFilename(appId, onlyGaps),
    comparisonCsv(data.competitors, data.rows, appId, t),
  );
}
