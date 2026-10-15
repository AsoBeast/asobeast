import type { TrackedKeywordItem } from "@asobeast/shared";
import { pluralize } from "@/lib/format";
import { activeKeywordCount } from "./setup-progress";

export const FIRST_POSITIONS_LIMIT = 8;

export interface FirstPositionRow {
  keywordId: string;
  text: string;
  position: number | null;
  depth: number;
}

const byPosition = (a: FirstPositionRow, b: FirstPositionRow): number => {
  if (a.position !== b.position) {
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  }
  return a.text.localeCompare(b.text);
};

function checkedRows(
  keywords: readonly TrackedKeywordItem[],
): FirstPositionRow[] {
  return keywords
    .flatMap((keyword) =>
      keyword.active && keyword.latestDepth !== null
        ? [
            {
              keywordId: keyword.keywordId,
              text: keyword.text,
              position: keyword.latestPosition,
              depth: keyword.latestDepth,
            },
          ]
        : [],
    )
    .sort(byPosition);
}

export interface FirstPositions {
  headline: string;
  rows: FirstPositionRow[];
}

function headlineOf(checked: FirstPositionRow[], tracked: number): string {
  const best = checked[0];
  if (!best) {
    return `Positions are being collected for ${pluralize(tracked, "keyword")}.`;
  }
  if (best.position !== null) {
    return `Your app ranks #${best.position} for “${best.text}”.`;
  }
  const depth = Math.min(...checked.map((row) => row.depth));
  return `Checked ${checked.length} of ${pluralize(tracked, "keyword")}, none in the top ${depth} yet.`;
}

export function firstPositions(
  keywords: readonly TrackedKeywordItem[],
): FirstPositions {
  const checked = checkedRows(keywords);
  return {
    headline: headlineOf(checked, activeKeywordCount(keywords)),
    rows: checked.slice(0, FIRST_POSITIONS_LIMIT),
  };
}

export function positionLabel(row: FirstPositionRow): string {
  return row.position === null
    ? `not in the top ${row.depth}`
    : `#${row.position}`;
}
