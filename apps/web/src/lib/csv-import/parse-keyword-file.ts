import {
  detectColumns,
  IMPORT_FIELDS,
  NO_COLUMNS,
  type ColumnMapping,
} from "./columns";
import { decodeCsvBytes, type CsvEncoding } from "./decode";
import { toImportRows, type ParsedImportRows } from "./rows";
import { parseCsv, type CsvRecord, type Delimiter } from "./tokenize";

const SAMPLE_CHARS = 24;

export interface KeywordFile {
  encoding: CsvEncoding;
  fallback: boolean;
  delimiter: Delimiter | null;
  records: CsvRecord[];
  detected: ColumnMapping | null;
}

export interface FileView {
  hasHeader: boolean;
  mapping: ColumnMapping;
}

export interface MappedFile extends ParsedImportRows {
  columns: number;
  ignoredColumns: number;
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
  return {
    encoding,
    fallback,
    delimiter,
    records,
    detected: detectColumns(records[0]?.cells ?? []),
  };
}

export function initialView(file: KeywordFile): FileView {
  return file.detected
    ? { hasHeader: true, mapping: file.detected }
    : { hasHeader: false, mapping: { ...NO_COLUMNS, keyword: 0 } };
}

const dataRecords = (file: KeywordFile, view: FileView): CsvRecord[] =>
  view.hasHeader ? file.records.slice(1) : file.records;

export function mapKeywordFile(file: KeywordFile, view: FileView): MappedFile {
  const columns = widthOf(file);
  const mapped = IMPORT_FIELDS.filter(
    (field) => view.mapping[field] !== null,
  ).length;
  return {
    ...toImportRows(dataRecords(file, view), view.mapping),
    columns,
    ignoredColumns: Math.max(0, columns - mapped),
  };
}

export function columnOptions(
  file: KeywordFile,
  view: FileView,
): ColumnOption[] {
  const header = view.hasHeader ? (file.records[0]?.cells ?? []) : [];
  const first = dataRecords(file, view)[0]?.cells ?? [];
  return Array.from({ length: widthOf(file) }, (_, index) => ({
    index,
    label: header[index]?.trim() || `Column ${index + 1}`,
    sample: (first[index] ?? "").trim().slice(0, SAMPLE_CHARS),
  }));
}
