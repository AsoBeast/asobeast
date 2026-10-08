import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { keywordCsv } from "@/components/keywords/keyword-csv";
import {
  initialView,
  mapKeywordFile,
  readKeywordFile,
} from "./parse-keyword-file";

const tracked = (
  text: string,
  extra: Partial<TrackedKeywordItem> = {},
): TrackedKeywordItem => ({
  keywordId: `kw-${text}`,
  text,
  country: "us",
  source: "MANUAL",
  active: true,
  latestPosition: null,
  latestDepth: null,
  previousPosition: null,
  positionDelta1d: null,
  positionDelta7d: null,
  traffic: null,
  difficulty: null,
  volume: null,
  relevance: null,
  opportunity: null,
  bucket: null,
  scoredAt: null,
  scoreProvenance: null,
  serpVolatility7d: null,
  ...extra,
});

const importedFrom = (rows: TrackedKeywordItem[]) => {
  const bytes = new TextEncoder().encode(keywordCsv(rows));
  const file = readKeywordFile(bytes.buffer as ArrayBuffer);
  return {
    file,
    view: initialView(file),
    mapped: mapKeywordFile(file, initialView(file)),
  };
};

describe("importing the keyword export", () => {
  it("U-RT-01 gives back the phrase, market, tags and note of every row", () => {
    const { mapped } = importedFrom([
      tracked("focus timer", {
        country: "pl",
        tags: ["core", "exam season"],
        note: "May",
      }),
      tracked("zegar"),
    ]);

    expect(mapped.rows).toEqual([
      {
        keyword: "focus timer",
        country: "pl",
        tags: ["core", "exam season"],
        note: "May",
      },
      { keyword: "zegar", country: "us" },
    ]);
    expect(mapped.lines).toEqual([2, 3]);
  });

  it("U-RT-02 undoes the apostrophe the export puts before a formula like note", () => {
    const { mapped } = importedFrom([
      tracked("focus timer", { note: "=HYPERLINK(1)" }),
    ]);

    expect(mapped.rows[0].note).toBe("=HYPERLINK(1)");
  });

  it("U-RT-03 keeps a note with a comma, a quote and a line break whole", () => {
    const note = 'ranks, "top 3" in May\nreview in June';

    expect(
      importedFrom([tracked("focus timer", { note })]).mapped.rows[0].note,
    ).toBe(note);
  });

  it("U-RT-04 finds the four columns of the export among its twenty five and ignores the rest", () => {
    const { file, view, mapped } = importedFrom([tracked("focus timer")]);

    expect(file).toMatchObject({ encoding: "utf-8", delimiter: "," });
    expect(view).toEqual({
      hasHeader: true,
      mapping: { keyword: 0, country: 24, tags: 22, note: 23 },
    });
    expect(mapped).toMatchObject({ columns: 25, ignoredColumns: 21 });
  });
});
