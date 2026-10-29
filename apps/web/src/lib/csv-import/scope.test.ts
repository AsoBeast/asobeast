import { describe, expect, it } from "vitest";
import { applyScope, defaultApp, NO_SCOPE, scopeOf } from "./scope";
import type { CsvRecord } from "./tokenize";

const rowsOf = (...rows: string[][]): CsvRecord[] =>
  rows.map((cells, index) => ({ line: index + 2, cells }));

const HEADER = ["App Name", "App Id", "Platform", "Keyword"];
const DATA = rowsOf(
  ["Import Lab", "123456789", "iphone", "focus timer"],
  ["Import Lab", "123456789", "ipad", "focus timer"],
  ["Other App", "987654321", "iphone", "habit tracker"],
  ["Import Lab", "123456789", "android", "deep work"],
);

const TARGET = {
  store: "APP_STORE" as const,
  storeAppId: "123456789",
  name: "Import Lab",
};

const linesOf = (records: readonly CsvRecord[]): number[] =>
  records.map((record) => record.line);

describe("scopeOf", () => {
  it("U-SCOPE-01 finds the app and platform columns and groups the rows by app id", () => {
    expect(scopeOf(HEADER, DATA)).toEqual({
      appColumn: 1,
      platformColumn: 2,
      apps: [
        { value: "123456789", label: "Import Lab", rows: 3 },
        { value: "987654321", label: "Other App", rows: 1 },
      ],
      usedColumns: 3,
    });
  });

  it("U-SCOPE-02 groups the rows by app name when the file has no id column", () => {
    const scope = scopeOf(
      ["App Name", "Keywords", "Volume"],
      rowsOf(["Import Lab", "a", "1"], ["Other App", "b", "2"]),
    );

    expect(scope.appColumn).toBe(0);
    expect(scope.apps.map((app) => app.label)).toEqual([
      "Import Lab",
      "Other App",
    ]);
  });

  it("U-SCOPE-03 takes a Store column as the platform only when it holds stores", () => {
    expect(
      scopeOf(
        ["Keyword", "Store"],
        rowsOf(["a", "Poland"], ["b", "United States"]),
      ).platformColumn,
    ).toBeNull();
    expect(
      scopeOf(["Keyword", "Store"], rowsOf(["a", "ios"], ["b", "Android"]))
        .platformColumn,
    ).toBe(1);
  });

  it("U-SCOPE-04 takes the Platform column ahead of a Store column of country names", () => {
    expect(
      scopeOf(
        ["Platform", "Keyword", "Store"],
        rowsOf(["iphone", "a", "Poland"], ["mac", "b", "Poland"]),
      ).platformColumn,
    ).toBe(0);
  });

  it("U-SCOPE-05 does not count a blank app cell as an app", () => {
    expect(
      scopeOf(["App Id", "Keyword"], rowsOf(["1", "a"], ["", "b"], ["1", "c"]))
        .apps,
    ).toEqual([{ value: "1", label: "1", rows: 2 }]);
  });

  it("U-SCOPE-06 uses no app column when the file holds one app", () => {
    expect(
      scopeOf(["App Id", "Keyword"], rowsOf(["1", "a"], ["1", "b"]))
        .usedColumns,
    ).toBe(0);
  });

  it("U-SCOPE-07 finds no scope in a file without app or platform columns", () => {
    expect(
      scopeOf(["keyword", "country"], rowsOf(["a", "us"], ["b", "pl"])),
    ).toEqual({
      appColumn: null,
      platformColumn: null,
      apps: [],
      usedColumns: 0,
    });
  });
});

describe("defaultApp", () => {
  const scope = scopeOf(HEADER, DATA);

  it("U-SCOPE-08 picks the app whose id is the app's store id", () => {
    expect(defaultApp(scope, { ...TARGET, name: null })).toBe("123456789");
  });

  it("U-SCOPE-09 picks the app whose folded name is the app's name", () => {
    expect(
      defaultApp(scope, { ...TARGET, storeAppId: "1", name: "other  app!" }),
    ).toBe("987654321");
  });

  it("U-SCOPE-10 picks nothing for one app, no match, no target or nothing to match on", () => {
    const oneApp = scopeOf(
      ["App Id", "Keyword"],
      rowsOf(["123456789", "a"], ["123456789", "b"]),
    );

    expect(defaultApp(oneApp, TARGET)).toBeUndefined();
    expect(
      defaultApp(scope, { ...TARGET, storeAppId: "5", name: "Nope" }),
    ).toBeUndefined();
    expect(defaultApp(scope, null)).toBeUndefined();
    expect(
      defaultApp(scope, { ...TARGET, storeAppId: "", name: null }),
    ).toBeUndefined();
  });
});

describe("applyScope", () => {
  const scope = scopeOf(HEADER, DATA);

  it("U-SCOPE-11 leaves out the rows of other apps", () => {
    const scoped = applyScope(DATA, scope, "123456789", undefined);

    expect(linesOf(scoped.records)).toEqual([2, 3, 5]);
    expect(scoped).toMatchObject({ otherApps: 1, otherStore: 0 });
  });

  it("U-SCOPE-12 leaves out the rows of the other store", () => {
    const scoped = applyScope(DATA, scope, undefined, "APP_STORE");

    expect(linesOf(scoped.records)).toEqual([2, 3, 4]);
    expect(scoped).toMatchObject({ otherApps: 0, otherStore: 1 });
  });

  it("U-SCOPE-13 counts a row of another app on another store once, as another app", () => {
    expect(
      applyScope(
        rowsOf(["Other App", "987654321", "android", "x"]),
        scope,
        "123456789",
        "APP_STORE",
      ),
    ).toEqual({ records: [], otherApps: 1, otherStore: 0 });
  });

  it("U-SCOPE-14 keeps a row with blank app and platform cells", () => {
    const blank = rowsOf(["", "", "", "x"]);

    expect(applyScope(blank, scope, "123456789", "APP_STORE")).toEqual({
      records: blank,
      otherApps: 0,
      otherStore: 0,
    });
  });

  it("U-SCOPE-15 keeps every row without a scope", () => {
    expect(applyScope(DATA, NO_SCOPE, "123456789", "APP_STORE")).toEqual({
      records: DATA,
      otherApps: 0,
      otherStore: 0,
    });
  });
});
