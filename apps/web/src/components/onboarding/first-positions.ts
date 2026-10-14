import type { TrackedKeywordItem } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

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

export function firstPositionRows(
  keywords: readonly TrackedKeywordItem[],
): FirstPositionRow[] {
  return checkedRows(keywords).slice(0, FIRST_POSITIONS_LIMIT);
}

export function firstPositionsHeadline(
  keywords: readonly TrackedKeywordItem[],
): string {
  const tracked = keywords.filter((keyword) => keyword.active).length;
  const checked = checkedRows(keywords);
  const best = checked[0];
  if (!best) {
    return `Positions are being collected for ${pluralize(tracked, "keyword")}.`;
  }
  if (best.position !== null) {
    return `Your app ranks #${best.position} for “${best.text}”.`;
  }
  return `Checked ${checked.length} of ${pluralize(tracked, "keyword")}, none in the top ${best.depth} yet.`;
}

export function positionLabel(row: FirstPositionRow): string {
  return row.position === null
    ? `not in the top ${row.depth}`
    : `#${row.position}`;
}
