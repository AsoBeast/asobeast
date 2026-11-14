import type { KeywordCoverageRow } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  coverageByField,
  presentFields,
  screenshotTextCovered,
  uncoveredRows,
} from "./coverage-summary";

const row = (
  text: string,
  fields: KeywordCoverageRow["fields"],
  extra: Partial<KeywordCoverageRow> = {},
): KeywordCoverageRow => ({
  keywordId: text,
  text,
  bucket: null,
  fields,
  uncovered: fields.every((field) => !field.covered),
  ...extra,
});

const ROWS = [
  row(
    "focus timer",
    [
      { field: "keywordField", covered: true },
      { field: "title", covered: true },
      { field: "subtitle", covered: false },
    ],
    { screenshotText: { covered: true, positions: [1] } },
  ),
  row(
    "pomodoro",
    [
      { field: "title", covered: false },
      { field: "subtitle", covered: true },
    ],
    { screenshotText: { covered: false, positions: [] } },
  ),
  row("productivity app", [
    { field: "title", covered: false },
    { field: "subtitle", covered: false },
  ]),
];

describe("presentFields", () => {
  it("lists the fields the rows name in store order", () => {
    expect(presentFields(ROWS)).toEqual(["title", "subtitle", "keywordField"]);
  });

  it("lists nothing without rows", () => {
    expect(presentFields([])).toEqual([]);
  });
});

describe("coverageByField", () => {
  it("counts the keywords each field carries", () => {
    expect(coverageByField(ROWS)).toEqual([
      { field: "title", covered: 1 },
      { field: "subtitle", covered: 1 },
      { field: "keywordField", covered: 1 },
    ]);
  });

  it("counts a keyword once per field it sits in", () => {
    const [title] = coverageByField([ROWS[0], ROWS[0]]);
    expect(title).toEqual({ field: "title", covered: 2 });
  });
});

describe("screenshotTextCovered", () => {
  it("counts only rows whose screenshots were read and carry the keyword", () => {
    expect(screenshotTextCovered(ROWS)).toBe(1);
  });
});

describe("uncoveredRows", () => {
  it("keeps the rows the audit marks uncovered", () => {
    expect(uncoveredRows(ROWS).map((entry) => entry.text)).toEqual([
      "productivity app",
    ]);
  });
});
