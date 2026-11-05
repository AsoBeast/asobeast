import { formatRankPosition } from "@asobeast/shared";
import type { CompetitorGapKeyword } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import type { GapTab } from "@/lib/gap-lists";
import { UNNAMED_COMPETITOR } from "./comparison-scores";

const HEADERS = [
  "keyword",
  "market",
  "competitor",
  "theirPosition",
  "yourPosition",
  "popularity",
  "difficulty",
  "opportunity",
];

const TAB_HEADERS: Record<GapTab, string[]> = {
  gaps: [],
  winnable: [],
  threats: ["reason", "change"],
  lead: ["margin"],
};

const FILE_PREFIXES: Record<GapTab, string> = {
  gaps: "keyword-gaps",
  winnable: "winnable-keywords",
  threats: "keyword-threats",
  lead: "keywords-you-lead",
};

const cell = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

function competitorCell(
  row: CompetitorGapKeyword,
  names: ReadonlyMap<string, string | null>,
): string {
  if (row.bestCompetitorId === null) return "";
  return names.get(row.bestCompetitorId) ?? UNNAMED_COMPETITOR;
}

function tabCells(tab: GapTab, row: CompetitorGapKeyword): string[] {
  if (tab === "threats") return [row.threat ?? "", cell(row.competitorDelta)];
  if (tab === "lead") return [cell(row.gap)];
  return [];
}

export function gapCsv(
  tab: GapTab,
  rows: readonly CompetitorGapKeyword[],
  names: ReadonlyMap<string, string | null>,
): string {
  return toCsv(
    [...HEADERS, ...TAB_HEADERS[tab]],
    rows.map((row) => [
      row.text,
      row.country ?? "",
      competitorCell(row, names),
      cell(row.bestCompetitorPosition),
      formatRankPosition(row.yourPosition),
      cell(row.volume),
      cell(row.difficulty),
      cell(row.opportunity),
      ...tabCells(tab, row),
    ]),
  );
}

export function gapFilename(tab: GapTab, appId: string): string {
  return csvFilename(FILE_PREFIXES[tab], appId);
}

export function exportGaps(
  tab: GapTab,
  appId: string,
  rows: readonly CompetitorGapKeyword[],
  names: ReadonlyMap<string, string | null>,
): void {
  downloadCsv(gapFilename(tab, appId), gapCsv(tab, rows, names));
}
