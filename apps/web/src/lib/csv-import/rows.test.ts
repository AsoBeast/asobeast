import { describe, expect, it } from "vitest";
import type { CsvRecord } from "./tokenize";
import { splitTags, toImportRows } from "./rows";

const record = (line: number, ...cells: string[]): CsvRecord => ({
  line,
  cells,
});
const mapping = { keyword: 0, country: 1, tags: 2, note: 3 };

describe("toImportRows", () => {
  it("maps the columns of every record and carries its line", () => {
    expect(
      toImportRows(
        [
          record(2, " habit tracker ", " PL ", "core; brand", " Q4 "),
          record(5, "streak"),
        ],
        mapping,
      ),
    ).toEqual({
      rows: [
        {
          keyword: "habit tracker",
          country: "PL",
          tags: ["core", "brand"],
          note: "Q4",
        },
        { keyword: "streak" },
      ],
      lines: [2, 5],
    });
  });

  it("leaves a column that is not mapped out of the row", () => {
    const { rows } = toImportRows([record(1, "habit", "us", "core", "n")], {
      keyword: 0,
      country: null,
      tags: null,
      note: null,
    });

    expect(rows).toEqual([{ keyword: "habit" }]);
  });

  it("keeps a row whose keyword is empty so the server can say why", () => {
    expect(toImportRows([record(3, "", "us")], mapping).rows).toEqual([
      { keyword: "", country: "us" },
    ]);
  });

  it.each([
    ["'=HYPERLINK(1)", "=HYPERLINK(1)"],
    ["'+1", "+1"],
    ["'-3", "-3"],
    ["'@mention", "@mention"],
    ["'plain", "'plain"],
    ["it's", "it's"],
  ])("reads the cell %j as %j", (cell, expected) => {
    expect(
      toImportRows([record(1, "habit", "", "", cell)], mapping).rows[0].note,
    ).toBe(expected);
  });
});

describe("splitTags", () => {
  it.each([
    ["core; exam season", ["core", "exam season"]],
    ["core|brand", ["core", "brand"]],
    ["core, brand ,testing", ["core", "brand", "testing"]],
    [" ; ;", []],
    ["", []],
  ])("splits %j", (cell, tags) => {
    expect(splitTags(cell)).toEqual(tags);
  });
});
