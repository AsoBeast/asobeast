import {
  isStorefront,
  KEYWORD_IMPORT_LIMIT,
  KEYWORD_IMPORT_STATUSES,
  UnknownStorefrontError,
  type KeywordImportRequest,
  type KeywordImportResult,
  type KeywordImportRow,
  type KeywordImportRowResult,
  type KeywordImportStatus,
  type KeywordImportSummary,
  type Store,
} from "@asobeast/shared";
import type { CsvEncoding } from "@/lib/csv-import/decode";
import { formatNumber } from "@/lib/format";
import { formatQuotaUsage, hasNoCapacity } from "@/lib/quota-usage";

export const IMPORT_BODY_BYTES = 96_000;

export type ImportRefusal =
  | { kind: "empty" }
  | { kind: "tooManyRows"; rows: number; limit: number }
  | { kind: "tooLarge"; fits: number };

export const IMPORT_STATUS_LABELS: Record<KeywordImportStatus, string> = {
  new: "New",
  resume: "Resume",
  tracked: "Already tracked",
  duplicate: "Duplicate",
  invalid: "Invalid",
  overQuota: "Over limit",
};

export const IMPORT_STATUS_VARIANT: Record<
  KeywordImportStatus,
  "success" | "info" | "secondary" | "outline" | "destructive" | "warning"
> = {
  new: "success",
  resume: "info",
  tracked: "secondary",
  duplicate: "outline",
  invalid: "destructive",
  overQuota: "warning",
};

const bytesOf = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;

function rowsThatFit(
  rows: readonly KeywordImportRow[],
  country: string,
): number {
  let bytes = bytesOf({ rows: [], country });
  let fits = 0;
  for (const row of rows) {
    bytes += bytesOf(row) + 1;
    if (bytes > IMPORT_BODY_BYTES) break;
    fits += 1;
  }
  return fits;
}

export function refuseImport(
  rows: readonly KeywordImportRow[],
  country: string,
): ImportRefusal | null {
  if (rows.length === 0) return { kind: "empty" };
  if (rows.length > KEYWORD_IMPORT_LIMIT) {
    return {
      kind: "tooManyRows",
      rows: rows.length,
      limit: KEYWORD_IMPORT_LIMIT,
    };
  }
  const request: KeywordImportRequest = { rows: [...rows], country };
  return bytesOf(request) > IMPORT_BODY_BYTES
    ? { kind: "tooLarge", fits: rowsThatFit(rows, country) }
    : null;
}

export function refusalMessage(refusal: ImportRefusal): string {
  switch (refusal.kind) {
    case "empty":
      return "The file has no keyword rows.";
    case "tooManyRows":
      return `The file has ${formatNumber(refusal.rows)} rows. One import takes up to ${formatNumber(refusal.limit)} rows, so split the file and import the parts one after the other.`;
    case "tooLarge":
      return `These rows are too large for one request. About ${formatNumber(refusal.fits)} rows fit, so split the file at that size.`;
  }
}

export function importableCount(summary: KeywordImportSummary): number {
  return summary.new + summary.resume;
}

export function importButtonLabel(summary: KeywordImportSummary): string {
  const count = importableCount(summary);
  if (count === 0) return "Nothing to import";
  return `Import ${formatNumber(count)} keyword${count === 1 ? "" : "s"}`;
}

export function rowNote(
  result: KeywordImportRowResult,
  lines: readonly number[],
): string {
  switch (result.status) {
    case "invalid":
      return result.message ?? "";
    case "duplicate":
      return `Repeats line ${lines[result.duplicateOf ?? 0]}`;
    case "tracked":
      return "Already tracked, nothing changes";
    case "resume":
      return "Paused, will resume";
    case "overQuota":
      return "Over your plan's keyword limit, skipped";
    case "new":
      return "";
  }
}

export function fileNotices(file: {
  encoding: CsvEncoding;
  fallback: boolean;
  hasHeader: boolean;
  ignoredColumns: number;
}): string[] {
  const notices: string[] = [];
  if (file.fallback) {
    notices.push(
      "This file is not UTF-8, so it was read as Windows-1252. If letters look wrong, save it as CSV UTF-8 and choose it again.",
    );
  }
  if (!file.hasHeader) {
    notices.push(
      "No header row was found, so column 1 is read as the keyword.",
    );
  }
  if (file.ignoredColumns > 0) {
    notices.push(
      `${file.ignoredColumns} other column${file.ignoredColumns === 1 ? " is" : "s are"} ignored.`,
    );
  }
  return notices;
}

export function marketRefusal(store: Store, market: string): string | null {
  return isStorefront(store, market)
    ? null
    : `${new UnknownStorefrontError(store, market).message}. Choose the market for rows without a country.`;
}

export interface QuotaNotice {
  text: string;
  upgrade: boolean;
}

export function quotaNotice({
  summary,
  quota,
}: Pick<KeywordImportResult, "summary" | "quota">): QuotaNotice | null {
  const over = summary.overQuota;
  if (quota === null || over === 0) return null;
  const used = hasNoCapacity(quota)
    ? "Your plan includes no keyword markets."
    : `${formatQuotaUsage(quota)} keyword markets used.`;
  const rows =
    over === 1
      ? "1 row is over your plan's keyword limit and is skipped."
      : `${formatNumber(over)} rows are over your plan's keyword limit and are skipped.`;
  return { text: `${used} ${rows}`, upgrade: quota.upgradeTo !== null };
}

export function summarySentence(summary: KeywordImportSummary): string {
  const parts = KEYWORD_IMPORT_STATUSES.filter(
    (status) => summary[status] > 0,
  ).map(
    (status) =>
      `${formatNumber(summary[status])} ${IMPORT_STATUS_LABELS[status].toLowerCase()}`,
  );
  return parts.length > 0 ? parts.join(", ") : "No rows";
}

export function importToast(
  result: Pick<KeywordImportResult, "imported" | "summary">,
): { title: string; description: string } {
  const skipped = result.summary.rows - importableCount(result.summary);
  return {
    title: `Tracking ${formatNumber(result.imported)} keyword${result.imported === 1 ? "" : "s"}`,
    description:
      skipped > 0
        ? `${formatNumber(skipped)} row${skipped === 1 ? "" : "s"} skipped. Rankings capture on the next run.`
        : "Rankings capture on the next run.",
  };
}
