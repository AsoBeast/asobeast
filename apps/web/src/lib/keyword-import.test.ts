import { describe, expect, it } from "vitest";
import {
  KEYWORD_IMPORT_LIMIT,
  KEYWORD_IMPORT_STATUSES,
  type KeywordImportRow,
  type KeywordImportRowResult,
  type KeywordImportSummary,
} from "@asobeast/shared";
import {
  fileNotices,
  IMPORT_BODY_BYTES,
  IMPORT_STATUS_LABELS,
  importButtonLabel,
  importAction,
  importParts,
  importToast,
  marketRefusal,
  partNotice,
  partRows,
  quotaNotice,
  refuseImport,
  refusalMessage,
  rowNote,
  skipButtonLabel,
  summarySentence,
} from "./keyword-import";

const rowsOf = (count: number, note = "") =>
  Array.from({ length: count }, (_, index) => ({
    keyword: `fitness workout plan ${index}`,
    ...(note ? { note } : {}),
  }));

const summary = (
  parts: Partial<KeywordImportSummary>,
): KeywordImportSummary => ({
  rows: 0,
  new: 0,
  resume: 0,
  tracked: 0,
  duplicate: 0,
  invalid: 0,
  overQuota: 0,
  ...parts,
});

const fileOf = (rows: KeywordImportRow[]) => ({
  rows,
  lines: rows.map((_, index) => index + 2),
});

const bodyBytes = (rows: KeywordImportRow[]) =>
  new TextEncoder().encode(JSON.stringify({ rows, country: "us" })).length;

describe("refuseImport", () => {
  it("U-REQ-01 refuses a file with no rows", () => {
    expect(refuseImport(fileOf([]), "us")).toEqual({ kind: "empty" });
  });

  it("U-REQ-02 lets a file of any length through when each row fits a request", () => {
    expect(
      refuseImport(fileOf(rowsOf(KEYWORD_IMPORT_LIMIT * 3, "note")), "us"),
    ).toBeNull();
  });

  it("U-REQ-03 refuses a row too large to send on its own and names its line", () => {
    const rows = rowsOf(3);
    rows[1] = { keyword: "fitness", note: "x".repeat(IMPORT_BODY_BYTES) };

    expect(refuseImport(fileOf(rows), "us")).toEqual({
      kind: "rowTooLarge",
      line: 3,
    });
  });

  it("U-REQ-04 counts bytes, not characters, so a CJK note is measured as sent", () => {
    const rows = [{ keyword: "fitness", note: "习".repeat(32_000) }];

    expect(refuseImport(fileOf(rows), "us")).toMatchObject({
      kind: "rowTooLarge",
    });
  });
});

describe("importParts", () => {
  it("U-REQ-05 keeps a file one import can carry in one part", () => {
    expect(importParts(rowsOf(KEYWORD_IMPORT_LIMIT), "us")).toEqual([
      { start: 0, end: KEYWORD_IMPORT_LIMIT },
    ]);
    expect(importParts([], "us")).toEqual([]);
  });

  it("U-REQ-06 splits a longer file into parts of the row limit", () => {
    expect(importParts(rowsOf(1_240), "us")).toEqual([
      { start: 0, end: 500 },
      { start: 500, end: 1_000 },
      { start: 1_000, end: 1_240 },
    ]);
  });

  it("U-REQ-07 splits rows too large for one request so each part fits the body limit", () => {
    const rows = rowsOf(300, "习".repeat(160));
    const parts = importParts(rows, "us");

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]?.start).toBe(0);
    expect(parts.at(-1)?.end).toBe(rows.length);
    for (const [index, part] of parts.entries()) {
      expect(part.end).toBeGreaterThan(part.start);
      expect(part.start).toBe(index === 0 ? 0 : parts[index - 1]?.end);
      expect(bodyBytes(rows.slice(part.start, part.end))).toBeLessThanOrEqual(
        IMPORT_BODY_BYTES,
      );
    }
  });

  it("U-REQ-08 gives a row that fills a request a part of its own", () => {
    const big = { keyword: "fitness", note: "x".repeat(60_000) };
    const small = { keyword: "fitness workout plan" };
    const rows = [small, big, big, small];

    expect(importParts(rows, "us")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });
});

describe("partRows", () => {
  it("U-REQ-09 cuts the rows and their file lines of one part", () => {
    expect(partRows(fileOf(rowsOf(4)), { start: 1, end: 3 })).toEqual({
      rows: rowsOf(4).slice(1, 3),
      lines: [3, 4],
    });
  });
});

describe("partNotice", () => {
  const lines = Array.from({ length: 677 }, (_, index) => index + 2);
  const parts = [
    { start: 0, end: 500 },
    { start: 500, end: 677 },
  ];

  it("U-REQ-10 says which part is reviewed and which lines it holds", () => {
    expect(partNotice(parts, { index: 1, count: 2 }, lines)).toBe(
      "The 677 rows are imported in 2 parts, one after the other. Part 2 holds lines 502 to 678.",
    );
  });

  it("U-REQ-10 says nothing for a file of one part", () => {
    expect(
      partNotice([{ start: 0, end: 3 }], { index: 0, count: 1 }, [2, 3, 4]),
    ).toBeNull();
  });
});

describe("importAction", () => {
  const resultOf = (parts: Partial<KeywordImportSummary>) => ({
    summary: summary(parts),
  });

  it("U-REQ-11 imports a part with rows to track", () => {
    expect(
      importAction(resultOf({ rows: 2, new: 1, tracked: 1 }), {
        index: 0,
        count: 1,
      }),
    ).toBe("import");
  });

  it("U-REQ-11 skips a part with nothing to track while a later part waits", () => {
    const done = resultOf({ rows: 500, tracked: 500 });

    expect(importAction(done, { index: 0, count: 2 })).toBe("skip");
    expect(importAction(done, { index: 1, count: 2 })).toBeNull();
    expect(importAction(null, { index: 0, count: 2 })).toBeNull();
    expect(skipButtonLabel({ index: 0, count: 2 })).toBe("Skip to part 2");
  });
});

describe("refusalMessage", () => {
  it("says why a file is refused", () => {
    expect(refusalMessage({ kind: "rowTooLarge", line: 1_204 })).toBe(
      "Line 1,204 is too large to send. Shorten its note or tags, or remove the line, and choose the file again.",
    );
    expect(refusalMessage({ kind: "empty" })).toBe(
      "The file has no keyword rows.",
    );
  });
});

describe("status copy", () => {
  it("U-VIEW-01 words every status the API can answer", () => {
    expect(Object.keys(IMPORT_STATUS_LABELS)).toEqual([
      ...KEYWORD_IMPORT_STATUSES,
    ]);
  });

  it.each([
    [summary({ new: 3, resume: 2 }), "Import 5 keywords"],
    [summary({ new: 1 }), "Import 1 keyword"],
    [summary({ tracked: 4, invalid: 2 }), "Nothing to import"],
  ])("U-VIEW-02 labels the button for %j", (counts, label) => {
    expect(importButtonLabel(counts)).toBe(label);
  });
});

describe("rowNote", () => {
  const result = (
    parts: Partial<KeywordImportRowResult>,
  ): KeywordImportRowResult => ({
    index: 0,
    keyword: "habit",
    country: "us",
    status: "new",
    ...parts,
  });

  it("U-VIEW-03 explains each status in the words of the person", () => {
    const lines = [2, 3, 7];

    expect(
      rowNote(
        result({ status: "invalid", message: "Keyword must not be empty" }),
        lines,
      ),
    ).toBe("Keyword must not be empty");
    expect(
      rowNote(result({ index: 2, status: "duplicate", duplicateOf: 0 }), lines),
    ).toBe("Repeats line 2");
    expect(rowNote(result({ status: "tracked" }), lines)).toBe(
      "Already tracked, nothing changes",
    );
    expect(rowNote(result({ status: "resume" }), lines)).toBe(
      "Paused, will resume",
    );
    expect(rowNote(result({ status: "overQuota" }), lines)).toBe(
      "Over your plan's keyword limit, skipped",
    );
    expect(rowNote(result({ status: "new" }), lines)).toBe("");
  });
});

describe("fileNotices", () => {
  const base = {
    fallback: false,
    hasHeader: true,
    ignoredColumns: 0,
  };

  it("U-VIEW-04 says nothing about a file that read cleanly", () => {
    expect(fileNotices(base)).toEqual([]);
  });

  it("U-VIEW-05 says when letters were read as Windows-1252", () => {
    expect(fileNotices({ ...base, fallback: true })).toEqual([
      "This file is not UTF-8, so it was read as Windows-1252. If letters look wrong, save it as CSV UTF-8 and choose it again.",
    ]);
  });

  it("U-VIEW-06 says when there was no header and what was ignored", () => {
    expect(
      fileNotices({ ...base, hasHeader: false, ignoredColumns: 2 }),
    ).toEqual([
      "No header row was found, so column 1 is read as the keyword.",
      "2 other columns are ignored.",
    ]);
    expect(
      fileNotices({ ...base, hasHeader: false, ignoredColumns: 1 })[1],
    ).toBe("1 other column is ignored.");
  });

  it("U-VIEW-07 says what was left out, in the order the person acts on it", () => {
    expect(
      fileNotices({
        ...base,
        ignoredColumns: 3,
        store: "APP_STORE",
        leftOut: { otherApps: 4, otherStore: 1 },
      }),
    ).toEqual([
      "4 rows for other apps are left out.",
      "1 row for Google Play is left out.",
      "3 other columns are ignored.",
    ]);
  });

  it("U-VIEW-08 asks the person to choose one of the apps of the file", () => {
    expect(fileNotices({ ...base, appsToChoose: 3 })).toEqual([
      "This file holds rows for 3 apps. Choose one under App to import, or All apps, before you import.",
    ]);
  });

  it("U-VIEW-09 says how many rows above the header were skipped", () => {
    expect(fileNotices({ ...base, skippedRows: 2 })).toEqual([
      "2 rows above the header were skipped.",
    ]);
    expect(fileNotices({ ...base, skippedRows: 1 })).toEqual([
      "1 row above the header was skipped.",
    ]);
  });
});

describe("quotaNotice", () => {
  const quota = { used: 998, limit: 1000, upgradeTo: "ultimate" as const };

  it("says nothing while every row fits the plan", () => {
    expect(quotaNotice({ summary: summary({ new: 2 }), quota })).toBeNull();
    expect(
      quotaNotice({ summary: summary({ overQuota: 2 }), quota: null }),
    ).toBeNull();
  });

  it("states the keyword markets used and the rows over the limit, with an upgrade", () => {
    expect(
      quotaNotice({ summary: summary({ new: 2, overQuota: 3 }), quota }),
    ).toEqual({
      text: "998 of 1,000 keyword markets used. 3 rows are over your plan's keyword limit and are skipped.",
      upgrade: true,
    });
  });

  it("offers no upgrade when there is no larger plan, and words one row and an empty plan", () => {
    expect(
      quotaNotice({
        summary: summary({ overQuota: 1 }),
        quota: { used: 0, limit: 0, upgradeTo: null },
      }),
    ).toEqual({
      text: "Your plan includes no keyword markets. 1 row is over your plan's keyword limit and is skipped.",
      upgrade: false,
    });
  });
});

describe("marketRefusal", () => {
  it("accepts a storefront of the app's store", () => {
    expect(marketRefusal("APP_STORE", "pl")).toBeNull();
  });

  it("asks for a market when the default market is not a storefront", () => {
    expect(marketRefusal("APP_STORE", "zz")).toBe(
      "zz is not an App Store storefront. Choose the market for rows without a country.",
    );
  });
});

describe("summarySentence", () => {
  it("U-VIEW-07 lists only the statuses that occur, importable ones first", () => {
    expect(
      summarySentence(summary({ rows: 9, new: 4, tracked: 3, invalid: 2 })),
    ).toBe("4 new, 3 already tracked, 2 invalid");
    expect(summarySentence(summary({ rows: 1, overQuota: 1 }))).toBe(
      "1 over limit",
    );
    expect(summarySentence(summary({ rows: 0 }))).toBe("No rows");
  });
});

describe("importToast", () => {
  it("U-VIEW-08 says what was tracked and how many rows were skipped", () => {
    const result = {
      dryRun: false,
      imported: 5,
      summary: summary({
        rows: 9,
        new: 4,
        resume: 1,
        tracked: 2,
        invalid: 1,
        overQuota: 1,
      }),
    };

    expect(importToast(result)).toEqual({
      title: "Tracking 5 keywords",
      description: "4 rows skipped. Rankings capture on the next run.",
    });
    expect(
      importToast({
        ...result,
        imported: 1,
        summary: summary({ rows: 1, new: 1 }),
      }),
    ).toEqual({
      title: "Tracking 1 keyword",
      description: "Rankings capture on the next run.",
    });
  });

  it("U-VIEW-10 points to the next part until the last one is in", () => {
    const result = {
      imported: 498,
      summary: summary({ rows: 500, new: 498, duplicate: 2 }),
    };

    expect(importToast(result, { index: 0, count: 2 })).toEqual({
      title: "Tracking 498 keywords",
      description:
        "2 rows skipped. Part 1 of 2 is in. Review part 2 and import it next.",
    });
    expect(importToast(result, { index: 1, count: 2 }).description).toBe(
      "2 rows skipped. Rankings capture on the next run.",
    );
  });
});
