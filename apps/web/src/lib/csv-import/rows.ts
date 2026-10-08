import type { KeywordImportRow } from "@asobeast/shared";
import type { ColumnMapping } from "./columns";
import type { CsvRecord } from "./tokenize";

export interface ParsedImportRows {
  rows: KeywordImportRow[];
  lines: number[];
}

const NEUTRALIZED = /^'(?=[=+\-@\t\r\n])/;

function cellAt(cells: readonly string[], index: number | null): string {
  return index === null
    ? ""
    : (cells[index] ?? "").replace(NEUTRALIZED, "").trim();
}

export function splitTags(cell: string): string[] {
  return cell
    .split(/[;|,\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

export function toImportRows(
  records: readonly CsvRecord[],
  mapping: ColumnMapping,
): ParsedImportRows {
  const rows: KeywordImportRow[] = [];
  const lines: number[] = [];
  for (const { line, cells } of records) {
    const country = cellAt(cells, mapping.country);
    const tags = splitTags(cellAt(cells, mapping.tags));
    const note = cellAt(cells, mapping.note);
    rows.push({
      keyword: cellAt(cells, mapping.keyword),
      ...(country ? { country } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(note ? { note } : {}),
    });
    lines.push(line);
  }
  return { rows, lines };
}
