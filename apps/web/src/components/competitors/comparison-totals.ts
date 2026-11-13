import type { KeywordComparisonRow } from "@asobeast/shared";
import { isChecked } from "./comparison-checks";

const TOP_TEN = 10;

export interface HeadToHead {
  lead: number;
  trail: number;
}

export function headToHead(
  rows: readonly KeywordComparisonRow[],
  appId: string,
  competitorId: string,
): HeadToHead {
  const totals = { lead: 0, trail: 0 };
  for (const row of rows) {
    if (!isChecked(row, appId) || !isChecked(row, competitorId)) continue;
    const theirs = row.positions[competitorId] ?? null;
    if (row.you === null && theirs === null) continue;
    if (theirs === null || (row.you !== null && row.you < theirs)) {
      totals.lead += 1;
    } else if (row.you === null || theirs < row.you) {
      totals.trail += 1;
    }
  }
  return totals;
}

export function topTenCount(
  rows: readonly KeywordComparisonRow[],
  appId: string,
): number {
  return rows.filter(
    (row) => isChecked(row, appId) && row.you !== null && row.you <= TOP_TEN,
  ).length;
}

export function headToHeadText({ lead, trail }: HeadToHead): string {
  return `You lead ${lead}, trail ${trail}`;
}

export function keywordCountText(count: number): string {
  return `${count} ${count === 1 ? "keyword" : "keywords"}`;
}
