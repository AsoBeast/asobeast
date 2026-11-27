import { listsNoApps, type TrackedKeywordItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";
import { pluralize } from "@/lib/format";
import { activeKeywordCount } from "./setup-progress";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

export const FIRST_POSITIONS_LIMIT = 8;

export interface FirstPositionRow {
  keywordId: string;
  text: string;
  position: number | null;
  depth: number;
  resultCount: number | null;
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
              resultCount: keyword.latestResultCount ?? null,
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

function headlineOf(
  checked: FirstPositionRow[],
  tracked: number,
  t: MessageTranslator,
): string {
  const best = checked[0];
  if (!best) {
    return t("firstPositions.collecting", { count: tracked });
  }
  if (best.position !== null) {
    return t("firstPositions.best", {
      position: best.position,
      keyword: best.text,
    });
  }
  const counted = `Checked ${checked.length} of ${pluralize(tracked, "keyword")}`;
  if (checked.every((row) => listsNoApps(row.resultCount))) {
    return `${counted}, and ${t("firstPositions.noApps")}.`;
  }
  const depth = Math.min(...checked.map((row) => row.depth));
  return t("firstPositions.checkedNone", {
    checked: checked.length,
    tracked,
    depth,
  });
}

export function firstPositions(
  keywords: readonly TrackedKeywordItem[],
  t: MessageTranslator = english,
): FirstPositions {
  const checked = checkedRows(keywords);
  return {
    headline: headlineOf(checked, activeKeywordCount(keywords), t),
    rows: checked.slice(0, FIRST_POSITIONS_LIMIT),
  };
}

export function positionLabel(
  row: FirstPositionRow,
  t: MessageTranslator = english,
): string {
  if (row.position !== null) return `#${row.position}`;
  if (listsNoApps(row.resultCount)) return t("firstPositions.noApps");
  return t("firstPositions.missing", { depth: row.depth });
}
