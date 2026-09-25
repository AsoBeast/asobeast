import { describe, expect, it } from "vitest";
import {
  RANK_DEPTH,
  type KeywordComparisonCompetitor,
  type KeywordComparisonRow,
} from "@asobeast/shared";
import { comparisonCsv, comparisonFilename } from "./comparison-csv";

const RIVAL: KeywordComparisonCompetitor = {
  id: "comp-1",
  name: "Rival Focus",
};

function row(over: Partial<KeywordComparisonRow> = {}): KeywordComparisonRow {
  return {
    keywordId: "kw-1",
    text: "focus timer",
    traffic: 5.5,
    difficulty: 4,
    you: 3,
    positions: { "comp-1": 9 },
    gap: false,
    ...over,
  };
}

const lines = (
  competitors: readonly KeywordComparisonCompetitor[],
  rows: readonly KeywordComparisonRow[],
) => comparisonCsv(competitors, rows).split("\r\n");

describe("comparisonCsv", () => {
  it("heads the file with the fixed columns around one column per competitor", () => {
    expect(lines([RIVAL], [])[0]).toBe(
      "﻿keyword,popularity,difficulty,you,Rival Focus,result,gap",
    );
  });

  it("neutralizes a formula-like keyword and competitor name", () => {
    const [header, first] = lines(
      [{ id: "comp-1", name: "+Rival" }],
      [row({ text: "=cmd|'/c calc'!A1" })],
    );
    expect(header).toContain(",you,'+Rival,result,");
    expect(first.startsWith("'=cmd|'/c calc'!A1,")).toBe(true);
  });

  it("writes scores on the display scale and leaves an unscored one empty", () => {
    expect(lines([RIVAL], [row({ traffic: 4.1, difficulty: 48.2 })])[1]).toBe(
      "focus timer,41,100,3,9,winning,false",
    );
    expect(lines([RIVAL], [row({ traffic: null, difficulty: null })])[1]).toBe(
      "focus timer,,,3,9,winning,false",
    );
  });

  it("formats positions as the matrix renders them", () => {
    expect(
      lines(
        [RIVAL],
        [row({ you: null, positions: { "comp-1": 8 }, gap: true })],
      )[1],
    ).toBe(`focus timer,55,40,>${RANK_DEPTH},8,losing,true`);
    expect(lines([RIVAL], [row({ positions: {} })])[1]).toBe(
      `focus timer,55,40,3,>${RANK_DEPTH},winning,false`,
    );
  });

  it("names the result and flags the gap", () => {
    expect(
      lines([RIVAL], [row({ you: 5, positions: { "comp-1": 5 } })])[1],
    ).toBe("focus timer,55,40,5,5,tied,false");
    expect(
      lines([RIVAL], [row({ you: null, positions: { "comp-1": null } })])[1],
    ).toBe(`focus timer,55,40,>${RANK_DEPTH},>${RANK_DEPTH},,false`);
  });

  it("keeps every header unique when competitor names repeat or are missing", () => {
    const named = (names: Array<string | null>) =>
      names.map((name, index) => ({ id: `comp-${index}`, name }));
    expect(lines(named(["Focus", "Focus", null, null, "you"]), [])[0]).toBe(
      "﻿keyword,popularity,difficulty,you,Focus,Focus (2),Competitor,Competitor (2),you (2),result,gap",
    );
    expect(lines(named(["Focus (2)", "Focus", "Focus"]), [])[0]).toContain(
      ",you,Focus (2),Focus,Focus (3),result,",
    );
  });
});

describe("comparisonFilename", () => {
  it("names the file for the gaps when only gaps is on", () => {
    expect(comparisonFilename("app-1", true)).toMatch(
      /^keyword-gaps-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(comparisonFilename("app-1", false)).toMatch(
      /^keyword-comparison-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
