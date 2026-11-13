import type {
  AppLocalizationItem,
  MetadataAuditResult,
} from "@asobeast/shared";
import { uncoveredRows } from "./coverage-summary";

export interface Tally {
  used: number;
  limit: number;
}

export interface MetadataStatus {
  fieldsWithIssues: number;
  keywords: number;
  uncovered: number;
  captions: { read: number; total: number } | null;
  keywordFieldSpace: Tally | null;
}

export function keywordFieldSpace(
  localizations: readonly AppLocalizationItem[],
): Tally | null {
  if (localizations.length === 0) return null;
  return localizations.reduce<Tally>(
    (sum, item) => ({
      used: sum.used + item.charactersUsed,
      limit: sum.limit + item.charactersLimit,
    }),
    { used: 0, limit: 0 },
  );
}

export function metadataStatus(
  result: MetadataAuditResult,
  localizations: readonly AppLocalizationItem[] | null,
): MetadataStatus {
  const text = result.screenshotText;
  return {
    fieldsWithIssues: result.fields.filter((field) => field.issues.length > 0)
      .length,
    keywords: result.coverage.length,
    uncovered: uncoveredRows(result.coverage).length,
    captions:
      text?.status === "ready" && text.total > 0
        ? { read: text.read, total: text.total }
        : null,
    keywordFieldSpace:
      localizations === null ? null : keywordFieldSpace(localizations),
  };
}
