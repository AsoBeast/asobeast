import { describe, expect, it } from "vitest";
import {
  RANK_DEPTH,
  type ScoreSignals,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { keywordCsv } from "./keyword-csv";

const TODAY = "2026-11-03";

function keyword(
  text: string,
  latestDepth: number | null = RANK_DEPTH,
): TrackedKeywordItem {
  return {
    keywordId: "kw-1",
    text,
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth,
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
  };
}

describe("keywordCsv", () => {
  it("neutralizes a formula-like keyword through the shared escaper", () => {
    expect(keywordCsv([keyword("=cmd|'/c calc'!A1")], TODAY)).toContain(
      "'=cmd|'/c calc'!A1",
    );
  });

  it("renders a checked but unranked position at the captured depth", () => {
    expect(keywordCsv([keyword("focus timer")], TODAY)).toContain(
      `focus timer,MANUAL,true,>${RANK_DEPTH},`,
    );
  });

  it("leaves the position empty for a keyword that was never checked", () => {
    expect(keywordCsv([keyword("focus timer", null)], TODAY)).toContain(
      "focus timer,MANUAL,true,,",
    );
  });

  it("exports a stored difficulty past its scale clamped to 100", () => {
    const row = keywordCsv(
      [{ ...keyword("geography quiz"), difficulty: 48.2 }],
      TODAY,
    )
      .split("\r\n")[1]
      .split(",");
    expect(row[8]).toBe("100");
  });

  it("adds the score evidence after the capture time", () => {
    expect(
      keywordCsv([keyword("focus timer")], TODAY).split("\r\n")[0],
      TODAY,
    ).toContain(
      "capturedAt,suggestReach,serpFlags,officialPopularity,officialPopularityState,officialPopularityFloor,officialPopularityWeek,lastAboveFloorValue,lastAboveFloorWeek,scoreOutdated,scoreComparability",
    );
  });

  it("exports the signals of a scored row", () => {
    const row = keywordCsv(
      [
        {
          ...keyword("geoguessr"),
          scoreSignals: {
            suggestReach: "hit",
            suggestPrefixLength: 4,
            suggestPosition: 4,
            serpRelevance: 0.1,
            medianRatingCount: 800,
            flags: ["brand", "padded"],
            officialPopularity: 71,
            estimatedTraffic: 4.2,
          },
          scoreOutdated: false,
        },
      ],
      TODAY,
    );
    expect(row).toContain(",hit,brand padded,71,,,,,,false,");
  });

  it("leaves the evidence empty for a row without signals", () => {
    const row = keywordCsv(
      [{ ...keyword("focus timer"), scoreSignals: null, scoreOutdated: true }],
      TODAY,
    );
    expect(row).toContain(",,,,,,,,,true,");
    expect(row).not.toMatch(/null|undefined/);
  });

  describe("the Apple floor answer", () => {
    const signals = (overrides: Partial<ScoreSignals>): ScoreSignals => ({
      suggestReach: "hit",
      suggestPrefixLength: 3,
      suggestPosition: 2,
      serpRelevance: 0.8,
      medianRatingCount: 12000,
      flags: [],
      officialPopularity: null,
      estimatedTraffic: 4,
      ...overrides,
    });
    const rowOf = (scoreSignals: ScoreSignals) =>
      keywordCsv(
        [{ ...keyword("world flags"), scoreSignals, scoreOutdated: false }],
        TODAY,
      ).split("\r\n")[1];

    it("exports a term listed at the floor with its last value", () => {
      expect(
        rowOf(
          signals({
            officialPopularity: 41,
            officialPopularityState: "floor",
            officialPopularityFloor: 41,
            officialPopularityWeek: "2026-10-18",
            officialPopularityLastAboveFloor: { value: 63, week: "2026-09-06" },
          }),
        ),
      ).toContain(",41,floor,41,2026-10-18,63,2026-09-06,false,");
    });

    it("exports a term Apple left out without a last value", () => {
      const row = rowOf(
        signals({
          officialPopularityState: "absent",
          officialPopularityFloor: 41,
          officialPopularityWeek: "2026-10-18",
        }),
      );

      expect(row).toContain(",hit,,,absent,41,2026-10-18,,,false,");
      expect(row).not.toMatch(/null|undefined/);
    });

    it("leaves the floor cells empty for a row scored before them", () => {
      expect(rowOf(signals({ officialPopularity: 71 }))).toContain(
        ",hit,,71,,,,,,false,",
      );
    });
  });

  it("appends the tags and the note after the existing columns", () => {
    const header = keywordCsv([keyword("focus timer")], TODAY).split("\r\n")[0];

    expect(header.endsWith(",scoreComparability,tags,note,country")).toBe(true);
    expect(header.split(",")).toHaveLength(34);
  });

  it("joins the tags and leaves a missing tag list and note empty", () => {
    const [, tagged, bare] = keywordCsv(
      [
        {
          ...keyword("focus timer"),
          tags: ["core", "exam season"],
          note: "May",
        },
        keyword("pomodoro"),
      ],
      TODAY,
    ).split("\r\n");

    expect(tagged.endsWith(",core; exam season,May,us")).toBe(true);
    expect(bare.endsWith(",,us")).toBe(true);
  });

  it("neutralizes a formula-like note", () => {
    const [, row] = keywordCsv(
      [{ ...keyword("focus timer"), note: "=HYPERLINK(1)" }],
      TODAY,
    ).split("\r\n");

    expect(row.endsWith(",'=HYPERLINK(1),us")).toBe(true);
  });

  it("exports the market of every row in lower case", () => {
    const [, us, pl] = keywordCsv(
      [keyword("focus timer"), { ...keyword("zegar"), country: "pl" }],
      TODAY,
    ).split("\r\n");

    expect(us.endsWith(",us")).toBe(true);
    expect(pl.endsWith(",pl")).toBe(true);
  });
});

function cellOf(row: TrackedKeywordItem, column: string): string {
  const [header, line] = keywordCsv([row], TODAY).split("\r\n");
  return line.split(",")[header.split(",").indexOf(column)];
}

describe("keywordCsv added day", () => {
  it("sits after relevance", () => {
    expect(
      keywordCsv([keyword("focus timer")], TODAY).split("\r\n")[0],
      TODAY,
    ).toContain("keywordClass,relevance,added,");
  });

  it("exports the UTC day the keyword was added", () => {
    expect(
      cellOf(
        {
          ...keyword("focus timer"),
          trackedAt: "2026-10-26T23:59:59.000Z",
        },
        "added",
      ),
    ).toBe("2026-10-26");
  });

  it("leaves the cell empty for a row without the day", () => {
    expect(cellOf(keyword("focus timer"), "added")).toBe("");
  });
});

describe("keywordCsv competitors in the top 10", () => {
  it("sits after the added day", () => {
    expect(
      keywordCsv([keyword("focus timer")], TODAY).split("\r\n")[0],
      TODAY,
    ).toContain("relevance,added,competitorsInTop10,scoredAt");
  });

  it.each([
    [2, "2"],
    [0, "0"],
    [null, ""],
    [undefined, ""],
  ])("exports %s as %j", (competitorsInTop10, expected) => {
    expect(
      cellOf(
        { ...keyword("focus timer"), competitorsInTop10 },
        "competitorsInTop10",
      ),
    ).toBe(expected);
  });
});

describe("keywordCsv insights", () => {
  it("sits after the opportunity", () => {
    expect(
      keywordCsv([keyword("focus timer")], TODAY).split("\r\n")[0],
    ).toContain(",opportunity,insights,bucket,");
  });

  it("writes every applicable insight, not only the two the table shows", () => {
    expect(
      cellOf(
        {
          ...keyword("pomodoro"),
          dropStreak: 3,
          latestPosition: 12,
          latestCheckedOn: TODAY,
          volume: 45,
          difficulty: 1.2,
          relevance: 80,
          uncovered: true,
        },
        "insights",
      ),
    ).toBe("Dropping; Page 1 close; Beatable; Not in listing");
  });

  it("writes the insights of the day it is given", () => {
    const row = {
      ...keyword("pomodoro"),
      dropStreak: 3,
      latestPosition: 12,
      latestCheckedOn: "2026-11-01",
    };
    expect(cellOf(row, "insights")).toBe("Dropping");
  });

  it("leaves the cell empty without an insight", () => {
    expect(cellOf(keyword("focus timer"), "insights")).toBe("");
  });
});

describe("keywordCsv keyword class", () => {
  it("sits right after the bucket", () => {
    expect(
      keywordCsv([keyword("focus timer")], TODAY).split("\r\n")[0],
    ).toContain(",insights,bucket,keywordClass,relevance,");
  });

  it.each([
    ["ownBrand", "ownBrand"],
    ["competitorBrand", "competitorBrand"],
    ["generic", "generic"],
    [undefined, ""],
  ] as const)("exports %s as %j", (keywordClass, expected) => {
    expect(
      cellOf({ ...keyword("focus timer"), keywordClass }, "keywordClass"),
    ).toBe(expected);
  });
});
