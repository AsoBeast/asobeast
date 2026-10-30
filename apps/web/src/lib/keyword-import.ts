import {
  isStorefront,
  KEYWORD_IMPORT_LIMIT,
  KEYWORD_IMPORT_STATUSES,
  UnknownStorefrontError,
  type KeywordImportResult,
  type KeywordImportRow,
  type KeywordImportRowResult,
  type KeywordImportStatus,
  type KeywordImportSummary,
  type Store,
} from "@asobeast/shared";
import type { ParsedImportRows } from "@/lib/csv-import/rows";
import type { LeftOut } from "@/lib/csv-import/scope";
import { formatNumber, storeLabel } from "@/lib/format";
import { formatQuotaUsage, hasNoCapacity } from "@/lib/quota-usage";

export const IMPORT_BODY_BYTES = 96_000;

export type ImportRefusal =
  { kind: "empty" } | { kind: "rowTooLarge"; line: number };

export interface ImportPart {
  start: number;
  end: number;
}

export interface ImportProgress {
  index: number;
  count: number;
}

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

const envelopeBytes = (country: string): number =>
  bytesOf({ rows: [], country });

const rowBytes = (row: KeywordImportRow): number => bytesOf(row) + 1;

export function refuseImport(
  { rows, lines }: ParsedImportRows,
  country: string,
): ImportRefusal | null {
  if (rows.length === 0) return { kind: "empty" };
  const room = IMPORT_BODY_BYTES - envelopeBytes(country);
  const oversized = rows.findIndex((row) => rowBytes(row) > room);
  return oversized < 0
    ? null
    : { kind: "rowTooLarge", line: lines[oversized] ?? oversized + 1 };
}

export function importParts(
  rows: readonly KeywordImportRow[],
  country: string,
): ImportPart[] {
  const envelope = envelopeBytes(country);
  const parts: ImportPart[] = [];
  let start = 0;
  let bytes = envelope;
  rows.forEach((row, index) => {
    const size = rowBytes(row);
    const full =
      index - start === KEYWORD_IMPORT_LIMIT ||
      bytes + size > IMPORT_BODY_BYTES;
    if (index > start && full) {
      parts.push({ start, end: index });
      start = index;
      bytes = envelope;
    }
    bytes += size;
  });
  if (rows.length > start) parts.push({ start, end: rows.length });
  return parts;
}

export const partRows = (
  { rows, lines }: ParsedImportRows,
  { start, end }: ImportPart,
): ParsedImportRows => ({
  rows: rows.slice(start, end),
  lines: lines.slice(start, end),
});

export function refusalMessage(refusal: ImportRefusal): string {
  switch (refusal.kind) {
    case "empty":
      return "The file has no keyword rows.";
    case "rowTooLarge":
      return `Line ${formatNumber(refusal.line)} is too large to send. Shorten its note or tags, or remove the line, and choose the file again.`;
  }
}

export function partNotice(
  parts: readonly ImportPart[],
  progress: ImportProgress,
  lines: readonly number[],
): string | null {
  const part = parts[progress.index];
  if (parts.length < 2 || !part) return null;
  return `The ${formatNumber(lines.length)} rows are imported in ${formatNumber(parts.length)} parts, one after the other. Part ${formatNumber(progress.index + 1)} holds lines ${formatNumber(lines[part.start] ?? 0)} to ${formatNumber(lines[part.end - 1] ?? 0)}.`;
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

const otherStore = (store: Store): Store =>
  store === "APP_STORE" ? "GOOGLE_PLAY" : "APP_STORE";

const leftOutSentence = (rows: number, subject: string): string =>
  `${formatNumber(rows)} row${rows === 1 ? "" : "s"} for ${subject} ${rows === 1 ? "is" : "are"} left out.`;

export interface FileNoticeFacts {
  fallback: boolean;
  hasHeader: boolean;
  ignoredColumns: number;
  skippedRows?: number;
  store?: Store;
  leftOut?: LeftOut;
  appsToChoose?: number;
}

export function fileNotices(file: FileNoticeFacts): string[] {
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
  if (file.skippedRows) {
    notices.push(
      `${formatNumber(file.skippedRows)} row${file.skippedRows === 1 ? "" : "s"} above the header ${file.skippedRows === 1 ? "was" : "were"} skipped.`,
    );
  }
  if (file.appsToChoose) {
    notices.push(
      `This file holds rows for ${formatNumber(file.appsToChoose)} apps. Choose one under App to import, or All apps, before you import.`,
    );
  }
  if (file.leftOut && file.leftOut.otherApps > 0) {
    notices.push(leftOutSentence(file.leftOut.otherApps, "other apps"));
  }
  if (file.leftOut && file.leftOut.otherStore > 0 && file.store) {
    notices.push(
      leftOutSentence(
        file.leftOut.otherStore,
        storeLabel(otherStore(file.store)),
      ),
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

function nextStep(progress: ImportProgress | undefined): string {
  if (!progress || progress.index + 1 >= progress.count) {
    return "Rankings capture on the next run.";
  }
  return `Part ${formatNumber(progress.index + 1)} of ${formatNumber(progress.count)} is in. Review part ${formatNumber(progress.index + 2)} and import it next.`;
}

export function importToast(
  result: Pick<KeywordImportResult, "imported" | "summary">,
  progress?: ImportProgress,
): { title: string; description: string } {
  const skipped = result.summary.rows - importableCount(result.summary);
  const skippedSentence =
    skipped > 0
      ? `${formatNumber(skipped)} row${skipped === 1 ? "" : "s"} skipped. `
      : "";
  return {
    title: `Tracking ${formatNumber(result.imported)} keyword${result.imported === 1 ? "" : "s"}`,
    description: `${skippedSentence}${nextStep(progress)}`,
  };
}
