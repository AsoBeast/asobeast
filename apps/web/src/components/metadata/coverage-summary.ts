import type { KeywordCoverageRow, MetadataField } from "@asobeast/shared";
import { screenshotTextMark } from "./screenshot-text-marks";

export const COVERAGE_SECTION_ID = "keyword-coverage";

export const FIELD_ORDER: MetadataField[] = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
];

export interface FieldCoverage {
  field: MetadataField;
  covered: number;
}

export function presentFields(
  rows: readonly KeywordCoverageRow[],
): MetadataField[] {
  const present = new Set(
    rows.flatMap((row) => row.fields.map((field) => field.field)),
  );
  return FIELD_ORDER.filter((field) => present.has(field));
}

export function coverageByField(
  rows: readonly KeywordCoverageRow[],
): FieldCoverage[] {
  return presentFields(rows).map((field) => ({
    field,
    covered: rows.filter((row) =>
      row.fields.some((entry) => entry.field === field && entry.covered),
    ).length,
  }));
}

export function screenshotTextCovered(
  rows: readonly KeywordCoverageRow[],
): number {
  return rows.filter((row) => screenshotTextMark(row) === "covered").length;
}

export function uncoveredRows(
  rows: readonly KeywordCoverageRow[],
): KeywordCoverageRow[] {
  return rows.filter((row) => row.uncovered);
}
