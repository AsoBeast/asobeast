import { describe, expect, it } from "vitest";
import {
  columnOptions,
  initialView,
  mapKeywordFile,
  readKeywordFile,
} from "./parse-keyword-file";

const bufferOf = (text: string): ArrayBuffer =>
  new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("readKeywordFile", () => {
  it("reads a semicolon file saved as UTF-16LE with a header, end to end", () => {
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(
        "Keyword;Market;Tags\r\nżółw;pl;core\r\nzegar;de;\r\n",
        "utf16le",
      ),
    ]);
    const file = readKeywordFile(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );

    const view = initialView(file);

    expect(file).toMatchObject({
      encoding: "utf-16le",
      delimiter: ";",
      fallback: false,
    });
    expect(view).toEqual({
      hasHeader: true,
      mapping: { keyword: 0, country: 1, tags: 2, note: null },
    });
    expect(mapKeywordFile(file, view)).toEqual({
      rows: [
        { keyword: "żółw", country: "pl", tags: ["core"] },
        { keyword: "zegar", country: "de" },
      ],
      lines: [2, 3],
      columns: 3,
      ignoredColumns: 0,
    });
  });

  it("reads a file without a header as one column of keywords and counts what it ignores", () => {
    const file = readKeywordFile(
      bufferOf("habit tracker,us,core\nstreak counter,pl,brand\n"),
    );

    const view = initialView(file);
    const mapped = mapKeywordFile(file, view);

    expect(view).toEqual({
      hasHeader: false,
      mapping: { keyword: 0, country: null, tags: null, note: null },
    });
    expect(mapped.rows.map((row) => row.keyword)).toEqual([
      "habit tracker",
      "streak counter",
    ]);
    expect(mapped).toMatchObject({
      columns: 3,
      ignoredColumns: 2,
      lines: [1, 2],
    });
  });

  it("reads a headerless single column of phrases, commas and all", () => {
    const file = readKeywordFile(bufferOf("habit tracker, streak\nfocus\n"));

    expect(mapKeywordFile(file, initialView(file)).rows).toEqual([
      { keyword: "habit tracker, streak" },
      { keyword: "focus" },
    ]);
  });

  it("lets the person say the first row is not a header and re-pick the keyword column", () => {
    const file = readKeywordFile(
      bufferOf("Query Term,Where\nhabit,us\nstreak,pl\n"),
    );

    const view = {
      hasHeader: false,
      mapping: { keyword: 1, country: null, tags: null, note: null },
    };

    expect(mapKeywordFile(file, view).rows.map((row) => row.keyword)).toEqual([
      "Where",
      "us",
      "pl",
    ]);
    expect(
      mapKeywordFile(file, { ...view, hasHeader: true }).rows.map(
        (row) => row.keyword,
      ),
    ).toEqual(["us", "pl"]);
  });
});

describe("columnOptions", () => {
  it("names a column by its header and by its position when there is none, with a sample", () => {
    const withHeader = readKeywordFile(bufferOf("keyword,country\nhabit,us\n"));
    const without = readKeywordFile(bufferOf("habit,us\nstreak,pl\n"));

    expect(columnOptions(withHeader, initialView(withHeader))).toEqual([
      { index: 0, label: "keyword", sample: "habit" },
      { index: 1, label: "country", sample: "us" },
    ]);
    expect(columnOptions(without, initialView(without))).toEqual([
      { index: 0, label: "Column 1", sample: "habit" },
      { index: 1, label: "Column 2", sample: "us" },
    ]);
  });
});
