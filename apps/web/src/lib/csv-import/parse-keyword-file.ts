import type { Store } from "@asobeast/shared";
import {
  detectColumns,
  IMPORT_FIELDS,
  NO_COLUMNS,
  type ColumnMapping,
} from "./columns";
import { decodeCsvBytes, type CsvEncoding } from "./decode";
import { toImportRows, type ParsedImportRows } from "./rows";
import {
  applyScope,
  defaultApp,
  NO_SCOPE,
  scopeOf,
  type FileScope,
  type ImportTarget,
  type LeftOut,
} from "./scope";
import {
  headerIndex,
  parseCsv,
  type CsvRecord,
  type Delimiter,
} from "./tokenize";

const SAMPLE_CHARS = 24;

export interface KeywordFile {
  encoding: CsvEncoding;
  fallback: boolean;
  delimiter: Delimiter | null;
  records: CsvRecord[];
  skippedRows: number;
  detected: ColumnMapping | null;
  scope: FileScope;
}

export interface FileView {
  hasHeader: boolean;
  mapping: ColumnMapping;
  app?: string;
}

export interface MappedFile extends ParsedImportRows {
  columns: number;
  ignoredColumns: number;
  leftOut?: LeftOut;
}

export interface ColumnOption {
  index: number;
  label: string;
  sample: string;
}

const widthOf = (file: KeywordFile): number =>
  file.records.reduce(
    (width, record) => Math.max(width, record.cells.length),
    0,
  );

export function readKeywordFile(buffer: ArrayBuffer): KeywordFile {
  const { text, encoding, fallback } = decodeCsvBytes(buffer);
  const { delimiter, records } = parseCsv(text);
  const skippedRows = headerIndex(records);
  const header = records[skippedRows]?.cells ?? [];
  const detected = detectColumns(header);
  return {
    encoding,
    fallback,
    delimiter,
    records,
    skippedRows,
    detected,
    scope: detected
      ? scopeOf(header, records.slice(skippedRows + 1))
      : NO_SCOPE,
  };
}

export function initialView(
  file: KeywordFile,
  target: ImportTarget | null = null,
): FileView {
  if (!file.detected) {
    return { hasHeader: false, mapping: { ...NO_COLUMNS, keyword: 0 } };
  }
  const app = defaultApp(file.scope, target);
  return {
    hasHeader: true,
    mapping: file.detected,
    ...(app === undefined ? {} : { app }),
  };
}

export const appsLeftToChoose = (
  file: KeywordFile,
  view: FileView,
  mapped: MappedFile,
): number =>
  view.hasHeader &&
  view.app === undefined &&
  file.scope.apps.length > 1 &&
  mapped.rows.length > 0
    ? file.scope.apps.length
    : 0;

export const skippedAboveHeader = (
  file: KeywordFile,
  view: FileView,
): number => (view.hasHeader ? file.skippedRows : 0);

const dataRecords = (file: KeywordFile, view: FileView): CsvRecord[] =>
  view.hasHeader ? file.records.slice(file.skippedRows + 1) : file.records;

export function mapKeywordFile(
  file: KeywordFile,
  view: FileView,
  store?: Store,
): MappedFile {
  const columns = widthOf(file);
  const mapped = IMPORT_FIELDS.filter(
    (field) => view.mapping[field] !== null,
  ).length;
  const scope = view.hasHeader ? file.scope : NO_SCOPE;
  const { records, ...leftOut } = applyScope(
    dataRecords(file, view),
    scope,
    view.app,
    store,
  );
  const anyLeftOut = leftOut.otherApps + leftOut.otherStore > 0;
  return {
    ...toImportRows(records, view.mapping),
    columns,
    ignoredColumns: Math.max(0, columns - mapped - scope.usedColumns),
    ...(anyLeftOut ? { leftOut } : {}),
  };
}

export function columnOptions(
  file: KeywordFile,
  view: FileView,
): ColumnOption[] {
  const header = view.hasHeader
    ? (file.records[file.skippedRows]?.cells ?? [])
    : [];
  const first = dataRecords(file, view)[0]?.cells ?? [];
  return Array.from({ length: widthOf(file) }, (_, index) => ({
    index,
    label: header[index]?.trim() || `Column ${index + 1}`,
    sample: (first[index] ?? "").trim().slice(0, SAMPLE_CHARS),
  }));
}
