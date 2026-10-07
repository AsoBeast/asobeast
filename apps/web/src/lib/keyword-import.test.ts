import { describe, expect, it } from "vitest";
import {
  KEYWORD_IMPORT_LIMIT,
  KEYWORD_IMPORT_STATUSES,
  type KeywordImportRowResult,
  type KeywordImportSummary,
} from "@asobeast/shared";
import {
  fileNotices,
  IMPORT_BODY_BYTES,
  IMPORT_STATUS_LABELS,
  importButtonLabel,
  importToast,
  marketRefusal,
  quotaNotice,
  refuseImport,
  refusalMessage,
  rowNote,
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

describe("refuseImport", () => {
  it("U-REQ-01 refuses a file with no rows and one with more than an import may carry", () => {
    expect(refuseImport([], "us")).toEqual({ kind: "empty" });
    expect(refuseImport(rowsOf(KEYWORD_IMPORT_LIMIT + 1), "us")).toEqual({
      kind: "tooManyRows",
      rows: KEYWORD_IMPORT_LIMIT + 1,
      limit: KEYWORD_IMPORT_LIMIT,
    });
  });

  it("U-REQ-02 lets the largest import of realistic rows through", () => {
    expect(
      refuseImport(
        rowsOf(KEYWORD_IMPORT_LIMIT, "Imported from the sheet"),
        "us",
      ),
    ).toBeNull();
  });

  it("U-REQ-03 refuses rows too large for one request and says how many fit", () => {
    const refusal = refuseImport(rowsOf(300, "x".repeat(500)), "us");

    expect(refusal).toMatchObject({ kind: "tooLarge" });
    const fits = refusal?.kind === "tooLarge" ? refusal.fits : 0;
    expect(fits).toBeGreaterThan(100);
    expect(fits).toBeLessThan(300);
    const kept = JSON.stringify({
      rows: rowsOf(fits, "x".repeat(500)),
      country: "us",
    });
    expect(new TextEncoder().encode(kept).length).toBeLessThanOrEqual(
      IMPORT_BODY_BYTES,
    );
  });

  it("U-REQ-04 counts bytes, not characters, so Thai and CJK notes are measured as sent", () => {
    const refusal = refuseImport(rowsOf(300, "习".repeat(160)), "us");

    expect(refusal).toMatchObject({ kind: "tooLarge" });
  });
});

describe("refusalMessage", () => {
  it("names the limit and how to split", () => {
    expect(
      refusalMessage({ kind: "tooManyRows", rows: 1240, limit: 500 }),
    ).toBe(
      "The file has 1,240 rows. One import takes up to 500 rows, so split the file and import the parts one after the other.",
    );
    expect(refusalMessage({ kind: "tooLarge", fits: 212 })).toBe(
      "These rows are too large for one request. About 212 rows fit, so split the file at that size.",
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
    encoding: "utf-8" as const,
    fallback: false,
    hasHeader: true,
    ignoredColumns: 0,
  };

  it("U-VIEW-04 says nothing about a file that read cleanly", () => {
    expect(fileNotices(base)).toEqual([]);
  });

  it("U-VIEW-05 says when letters were read as Windows-1252", () => {
    expect(
      fileNotices({ ...base, encoding: "windows-1252", fallback: true }),
    ).toEqual([
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
});
