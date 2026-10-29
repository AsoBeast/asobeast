import type { Store } from "@asobeast/shared";
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

describe("files exported by other tools", () => {
  const target = {
    store: "APP_STORE" as const,
    storeAppId: "123456789",
    name: "Import Lab",
  };

  const importedFrom = (text: string, store: Store = target.store) => {
    const file = readKeywordFile(bufferOf(text));
    const view = initialView(file, target);
    return { file, view, mapped: mapKeywordFile(file, view, store) };
  };

  const ASTRO_EXPORT = [
    "App Name,App Id,Platform,Keyword,Store Domain,Store,Note,Last Update,Ranking,Change,Popularity,Difficulty,Apps in Ranking,Tags",
    "Import Lab,123456789,iphone,focus timer,us,United States,,2026-10-12 08:30:00,4,2,48,31,120,",
    "Import Lab,123456789,ipad,focus timer,us,United States,,2026-10-12 08:30:00,6,0,48,31,120,",
    'Import Lab,123456789,iphone,zegar pracy,pl,Poland,"Launch keyword\nsecond line",2026-10-12 08:30:00,2,-1,22,18,64,"core, brand"',
    "Other App,987654321,iphone,habit tracker,us,United States,,2026-10-12 08:30:00,9,1,60,40,200,focus",
    "Import Lab,123456789,mac,focus timer,gb,United Kingdom,,2026-10-12 08:30:00,,,,,,",
  ].join("\r\n");

  it("U-VENDOR-01 reads an Astro export of all apps as the rows of the app it is imported into", () => {
    const { file, view, mapped } = importedFrom(ASTRO_EXPORT);

    expect(file).toMatchObject({
      encoding: "utf-8",
      delimiter: ",",
      fallback: false,
    });
    expect(view).toEqual({
      hasHeader: true,
      mapping: { keyword: 3, country: 4, tags: 13, note: 6 },
      app: "123456789",
    });
    expect(mapped).toEqual({
      rows: [
        { keyword: "focus timer", country: "us" },
        { keyword: "focus timer", country: "us" },
        {
          keyword: "zegar pracy",
          country: "pl",
          tags: ["core", "brand"],
          note: "Launch keyword\nsecond line",
        },
        { keyword: "focus timer", country: "gb" },
      ],
      lines: [2, 3, 4, 7],
      columns: 14,
      ignoredColumns: 7,
      leftOut: { otherApps: 1, otherStore: 0 },
    });
  });

  it("U-VENDOR-02 reads an AppTweak keyword export, which carries no country, in the market chosen in the dialog", () => {
    const { view, mapped } = importedFrom(
      [
        "App Name,Keywords,Volume,App Daily Installs",
        "Import Lab,focus timer,42,3",
        "Import Lab,deep work,31,1",
        "Rival App,pomodoro,55,9",
      ].join("\n"),
    );

    expect(view).toEqual({
      hasHeader: true,
      mapping: { keyword: 1, country: null, tags: null, note: null },
      app: "importlab",
    });
    expect(mapped).toEqual({
      rows: [{ keyword: "focus timer" }, { keyword: "deep work" }],
      lines: [2, 3],
      columns: 4,
      ignoredColumns: 2,
      leftOut: { otherApps: 1, otherStore: 0 },
    });
  });

  const SONAR_EXPORT = [
    "Keyword,Country,Store,Rank,Movement,Popularity,Difficulty,Est. downloads/day at current rank,Starred,Tags,Updated",
    'focus timer,us,ios,4,+2,48,31,12,yes,"core, brand",2026-10-12',
    "focus timer,us,android,9,-1,40,28,5,,,2026-10-12",
    "zegar pracy,pl,ios,2,0,22,18,3,,core,2026-10-12",
  ].join("\n");

  it("U-VENDOR-03 reads a Sonar keyword export and leaves out the rows of the other store", () => {
    const { view, mapped } = importedFrom(SONAR_EXPORT);

    expect(view.mapping).toEqual({
      keyword: 0,
      country: 1,
      tags: 9,
      note: null,
    });
    expect(mapped).toEqual({
      rows: [
        { keyword: "focus timer", country: "us", tags: ["core", "brand"] },
        { keyword: "zegar pracy", country: "pl", tags: ["core"] },
      ],
      lines: [2, 4],
      columns: 11,
      ignoredColumns: 7,
      leftOut: { otherApps: 0, otherStore: 1 },
    });
  });

  it("U-VENDOR-03 keeps the Google Play rows of a Sonar export imported into a Google Play app", () => {
    const { mapped } = importedFrom(SONAR_EXPORT, "GOOGLE_PLAY");

    expect(mapped).toMatchObject({
      rows: [{ keyword: "focus timer", country: "us" }],
      lines: [3],
      leftOut: { otherApps: 0, otherStore: 2 },
    });
  });

  it("U-VENDOR-04 reads the history that sonar export rankings writes as one row per keyword and day", () => {
    const { mapped } = importedFrom(
      [
        "keyword,date,rank",
        "focus timer,2026-10-11,5",
        "focus timer,2026-10-12,4",
      ].join("\n"),
    );

    expect(mapped).toMatchObject({
      rows: [{ keyword: "focus timer" }, { keyword: "focus timer" }],
      ignoredColumns: 2,
    });
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
