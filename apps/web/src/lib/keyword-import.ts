import {
  isStorefront,
  KEYWORD_IMPORT_LIMIT,
  KEYWORD_IMPORT_STATUSES,
  type KeywordImportResult,
  type KeywordImportRow,
  type KeywordImportRowResult,
  type KeywordImportStatus,
  type KeywordImportSummary,
  type Store,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../messages/en/keywords.json";
import type { ParsedImportRows } from "@/lib/csv-import/rows";
import type { LeftOut } from "@/lib/csv-import/scope";
import type { MessageTranslator, TranslationContext } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";
import { formatQuotaUsage, hasNoCapacity } from "@/lib/quota-usage";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

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
  new: enKeywords.import.statusNew,
  resume: enKeywords.import.statusResume,
  tracked: enKeywords.import.statusTracked,
  duplicate: enKeywords.import.statusDuplicate,
  invalid: enKeywords.import.statusInvalid,
  overQuota: enKeywords.import.statusOverQuota,
};

export function importStatusLabel(
  status: KeywordImportStatus,
  t: MessageTranslator = english,
): string {
  return t(`import.status${status[0].toUpperCase()}${status.slice(1)}`);
}

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

const rowBytesWithComma = (row: KeywordImportRow): number => bytesOf(row) + 1;

export function refuseImport(
  { rows, lines }: ParsedImportRows,
  country: string,
): ImportRefusal | null {
  if (rows.length === 0) return { kind: "empty" };
  const room = IMPORT_BODY_BYTES - envelopeBytes(country);
  const oversized = rows.findIndex((row) => rowBytesWithComma(row) > room);
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
    const size = rowBytesWithComma(row);
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

export function refusalMessage(
  refusal: ImportRefusal,
  t: MessageTranslator = english,
): string {
  switch (refusal.kind) {
    case "empty":
      return t("import.emptyFile");
    case "rowTooLarge":
      return t("import.rowTooLarge", { line: refusal.line });
  }
}

export function partNotice(
  parts: readonly ImportPart[],
  progress: ImportProgress,
  lines: readonly number[],
  t: MessageTranslator = english,
): string | null {
  const part = parts[progress.index];
  if (parts.length < 2 || !part) return null;
  return t("import.partNotice", {
    rows: lines.length,
    parts: parts.length,
    part: progress.index + 1,
    from: lines[part.start] ?? 0,
    to: lines[part.end - 1] ?? 0,
  });
}

export function importableCount(summary: KeywordImportSummary): number {
  return summary.new + summary.resume;
}

export type ImportAction = "import" | "skip";

export function importAction(
  result: Pick<KeywordImportResult, "summary"> | null,
  progress: ImportProgress,
): ImportAction | null {
  if (result === null) return null;
  if (importableCount(result.summary) > 0) return "import";
  return progress.index + 1 < progress.count ? "skip" : null;
}

export const skipButtonLabel = (
  progress: ImportProgress,
  t: MessageTranslator = english,
): string => t("import.skip", { part: progress.index + 2 });

export function importButtonLabel(
  summary: KeywordImportSummary,
  t: MessageTranslator = english,
): string {
  const count = importableCount(summary);
  if (count === 0) return t("import.nothing");
  return t("import.importCount", { count });
}

export function rowNote(
  result: KeywordImportRowResult,
  lines: readonly number[],
  t: MessageTranslator = english,
): string {
  switch (result.status) {
    case "invalid":
      return result.message ?? "";
    case "duplicate":
      return t("import.duplicateNote", {
        line: lines[result.duplicateOf ?? 0],
      });
    case "tracked":
      return t("import.trackedNote");
    case "resume":
      return t("import.resumeNote");
    case "overQuota":
      return t("import.overQuotaNote");
    case "new":
      return "";
  }
}

const otherStore = (store: Store): Store =>
  store === "APP_STORE" ? "GOOGLE_PLAY" : "APP_STORE";

const leftOutSentence = (
  rows: number,
  subject: string,
  t: MessageTranslator,
): string =>
  subject === "other apps"
    ? t("import.otherApps", { count: rows })
    : t("import.otherStore", { count: rows, store: subject });

export interface FileNoticeFacts {
  fallback: boolean;
  hasHeader: boolean;
  ignoredColumns: number;
  skippedRows?: number;
  store?: Store;
  leftOut?: LeftOut;
  appsToChoose?: number;
}

export function fileNotices(
  file: FileNoticeFacts,
  t: MessageTranslator = english,
): string[] {
  const notices: string[] = [];
  if (file.fallback) {
    notices.push(t("import.notUtf8"));
  }
  if (!file.hasHeader) {
    notices.push(t("import.noHeader"));
  }
  if (file.skippedRows) {
    notices.push(t("import.skippedRows", { count: file.skippedRows }));
  }
  if (file.appsToChoose) {
    notices.push(t("import.appsToChoose", { count: file.appsToChoose }));
  }
  if (file.leftOut && file.leftOut.otherApps > 0) {
    notices.push(leftOutSentence(file.leftOut.otherApps, "other apps", t));
  }
  if (file.leftOut && file.leftOut.otherStore > 0 && file.store) {
    notices.push(
      leftOutSentence(
        file.leftOut.otherStore,
        storeLabel(otherStore(file.store)),
        t,
      ),
    );
  }
  if (file.ignoredColumns > 0) {
    notices.push(t("import.ignoredColumns", { count: file.ignoredColumns }));
  }
  return notices;
}

export function marketRefusal(
  store: Store,
  market: string,
  t: MessageTranslator = english,
): string | null {
  return isStorefront(store, market)
    ? null
    : t(
        store === "APP_STORE"
          ? "import.unknownMarket.appStore"
          : "import.unknownMarket.googlePlay",
        { market, store: storeLabel(store) },
      );
}

export interface QuotaNotice {
  text: string;
  upgrade: boolean;
}

export function quotaNotice(
  { summary, quota }: Pick<KeywordImportResult, "summary" | "quota">,
  context: TranslationContext,
  t: MessageTranslator = english,
): QuotaNotice | null {
  const over = summary.overQuota;
  if (quota === null || over === 0) return null;
  const usage = hasNoCapacity(quota)
    ? "none"
    : formatQuotaUsage(quota, "tracked", context);
  return {
    text: t("import.quotaNotice", { usage, count: over }),
    upgrade: quota.upgradeTo !== null,
  };
}

export function summarySentence(
  summary: KeywordImportSummary,
  t: MessageTranslator = english,
): string {
  const parts = KEYWORD_IMPORT_STATUSES.filter(
    (status) => summary[status] > 0,
  ).map((status) =>
    t("import.summaryPart", {
      count: summary[status],
      status: importStatusLabel(status, t).toLocaleLowerCase(),
    }),
  );
  return parts.length > 0 ? parts.join(", ") : t("import.summaryNoRows");
}

function nextStep(
  progress: ImportProgress | undefined,
  t: MessageTranslator,
): string {
  if (!progress || progress.index + 1 >= progress.count) {
    return t("import.nextRun");
  }
  return t("import.nextPart", {
    part: progress.index + 1,
    parts: progress.count,
    next: progress.index + 2,
  });
}

export function importToast(
  result: Pick<KeywordImportResult, "imported" | "summary">,
  progress?: ImportProgress,
  t: MessageTranslator = english,
): { title: string; description: string } {
  const skipped = result.summary.rows - importableCount(result.summary);
  return {
    title: t("import.toastTitle", { count: result.imported }),
    description: t("import.toastDescription", {
      skipped: skipped > 0 ? "yes" : "none",
      count: skipped,
      step: nextStep(progress, t),
    }),
  };
}
