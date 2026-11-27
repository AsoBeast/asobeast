import { formatRankPosition } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import type { CompetitorGapKeyword } from "@asobeast/shared";
import enCompetitors from "../../../messages/en/competitors.json";
import type { MessageTranslator } from "@/i18n/translator";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import type { GapTab } from "@/lib/gap-lists";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

const TAB_HEADER_KEYS: Record<GapTab, string[]> = {
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
  t: MessageTranslator,
): string {
  if (row.bestCompetitorId === null) return "";
  return names.get(row.bestCompetitorId) ?? t("unnamed");
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
  t: MessageTranslator = english,
): string {
  const headers = [
    t("csv.keyword"),
    t("csv.market"),
    t("csv.competitor"),
    t("csv.theirPosition"),
    t("csv.yourPosition"),
    t("csv.popularity"),
    t("csv.difficulty"),
    t("csv.opportunity"),
    ...TAB_HEADER_KEYS[tab].map((key) => t(`csv.${key}`)),
  ];
  return toCsv(
    headers,
    rows.map((row) => [
      row.text,
      row.country ?? "",
      competitorCell(row, names, t),
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
  data: {
    rows: readonly CompetitorGapKeyword[];
    names: ReadonlyMap<string, string | null>;
  },
  t: MessageTranslator = english,
): void {
  downloadCsv(gapFilename(tab, appId), gapCsv(tab, data.rows, data.names, t));
}
