import { describe, expect, it } from "vitest";
import {
  appsLeftToChoose,
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

  it("reads a hand written file with a short last row by its header", () => {
    const file = readKeywordFile(
      bufferOf("keyword,country\nhabit tracker,us\nfocus timer"),
    );

    const view = initialView(file);

    expect(view.hasHeader).toBe(true);
    expect(mapKeywordFile(file, view).rows).toEqual([
      { keyword: "habit tracker", country: "us" },
      { keyword: "focus timer" },
    ]);
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

describe("a file that names the apps and stores of its rows", () => {
  const target = {
    store: "APP_STORE" as const,
    storeAppId: "123456789",
    name: "Import Lab",
  };
  const FILE = [
    "App Id,Platform,Keyword,Country,Position",
    "123456789,ios,focus timer,us,4",
    "987654321,ios,habit tracker,us,9",
    "123456789,android,deep work,us,7",
    "123456789,ios,zegar,pl,2",
  ].join("\n");

  it("U-SCOPE-16 imports the rows of the app and store it is imported into and says what it left out", () => {
    const file = readKeywordFile(bufferOf(FILE));
    const view = initialView(file, target);

    expect(view).toEqual({
      hasHeader: true,
      mapping: { keyword: 2, country: 3, tags: null, note: null },
      app: "123456789",
    });
    expect(mapKeywordFile(file, view, "APP_STORE")).toEqual({
      rows: [
        { keyword: "focus timer", country: "us" },
        { keyword: "zegar", country: "pl" },
      ],
      lines: [2, 5],
      columns: 5,
      ignoredColumns: 1,
      leftOut: { otherApps: 1, otherStore: 1 },
    });
  });

  it("U-SCOPE-17 imports every app of the file until one is chosen", () => {
    const file = readKeywordFile(bufferOf(FILE));
    const view = initialView(file, { ...target, storeAppId: "5", name: null });

    expect(view.app).toBeUndefined();
    expect(
      mapKeywordFile(file, view, "APP_STORE").rows.map((row) => row.keyword),
    ).toEqual(["focus timer", "habit tracker", "zegar"]);
  });

  it("U-SCOPE-18 reads the file whole when the first row is not a header", () => {
    const file = readKeywordFile(bufferOf(FILE));
    const view = { ...initialView(file, target), hasHeader: false };
    const mapped = mapKeywordFile(file, view, "APP_STORE");

    expect(mapped.rows).toHaveLength(5);
    expect(mapped.leftOut).toBeUndefined();
  });

  it("U-SCOPE-19 counts the apps still to choose from only while every app of the file is imported", () => {
    const file = readKeywordFile(bufferOf(FILE));
    const unmatched = initialView(file, {
      ...target,
      storeAppId: "5",
      name: null,
    });

    expect(appsLeftToChoose(file, unmatched)).toBe(2);
    expect(appsLeftToChoose(file, initialView(file, target))).toBe(0);
    expect(appsLeftToChoose(file, { ...unmatched, hasHeader: false })).toBe(0);
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
