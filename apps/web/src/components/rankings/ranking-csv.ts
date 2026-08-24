import { formatRankPosition } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import type { RankingChartData } from "./pivot";

export function rankingCsv(data: RankingChartData): string {
  const headers = [
    "date",
    ...data.keywordIds.map(
      (keywordId) => data.seriesLabels[keywordId] ?? keywordId,
    ),
  ];
  const rows = data.rows.map((row, index) => [
    row.date,
    ...data.keywordIds.map((keywordId) => {
      const value = row[keywordId];
      return formatRankPosition(
        typeof value === "number" ? value : null,
        data.depths[index]?.[keywordId] ?? undefined,
      );
    }),
  ]);

  return toCsv(headers, rows);
}

export function exportRankings(
  appId: string,
  range: { from: string; to: string },
  data: RankingChartData,
): void {
  downloadCsv(
    csvFilename("rankings", appId, range.from, range.to),
    rankingCsv(data),
  );
}
