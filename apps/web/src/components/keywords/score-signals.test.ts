import { describe, expect, it } from "vitest";
import type { ScoreSignals } from "@asobeast/shared";
import { revealColumn } from "./keyword-fact-columns";
import {
  difficultySignalLines,
  lowerConfidenceLines,
  popularitySignalLines,
  revealLabel,
  revealRank,
} from "./score-signals";

function signals(overrides: Partial<ScoreSignals> = {}): ScoreSignals {
  return {
    suggestReach: "hit",
    suggestPrefixLength: 2,
    suggestPosition: 8,
    serpRelevance: 0.9,
    medianRatingCount: 45_000,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: 5.4,
    ...overrides,
  };
}

describe("popularitySignalLines", () => {
  it.each([
    [
      signals(),
      "The store suggests it after 2 typed characters, in position 8.",
    ],
    [
      signals({ suggestPrefixLength: 1, suggestPosition: 1 }),
      "The store suggests it after 1 typed character, in position 1.",
    ],
    [
      signals({
        suggestReach: "listed",
        suggestPrefixLength: null,
        suggestPosition: 3,
      }),
      "The store suggests it only once the whole phrase is typed.",
    ],
    [
      signals({
        suggestReach: "absent",
        suggestPrefixLength: null,
        suggestPosition: null,
      }),
      "The store never suggests this phrase, so volume is capped.",
    ],
    [
      signals({
        suggestReach: "unavailable",
        suggestPrefixLength: null,
        suggestPosition: null,
      }),
      "Suggestions were unavailable, so volume assumes a typical reach.",
    ],
  ])("describes the suggest reach %#", (input, expected) => {
    expect(popularitySignalLines(input)).toEqual([expected]);
  });

  it("never shows a missing prefix or position as zero", () => {
    expect(
      popularitySignalLines(
        signals({ suggestPrefixLength: null, suggestPosition: null }),
      ),
    ).toEqual(["The store suggests it while it is being typed."]);
  });

  it("shows only apple's own number when it was used", () => {
    expect(popularitySignalLines(signals({ officialPopularity: 71 }))).toEqual([
      "Apple reports a search popularity of 71 for this term.",
    ]);
  });

  it("prefers apple's number over the app store estimate", () => {
    expect(
      popularitySignalLines(
        signals({ officialPopularity: 64 }),
        "APPLE_SEARCH_SIGNALS",
        64,
      ),
    ).toEqual(["Apple reports a search popularity of 64 for this term."]);
  });

  it("says when apple's list held the estimate down", () => {
    expect(
      popularitySignalLines(signals(), "APPLE_SEARCH_SIGNALS", 46),
    ).toEqual([
      "Estimated from the first 25 App Store results and search suggestions, on Apple's search popularity scale.",
      "Apple does not list this term among its most searched, so it is held below the lowest popularity Apple published for its genre.",
    ]);
    expect(
      popularitySignalLines(signals(), "APPLE_SEARCH_SIGNALS", 54),
    ).toHaveLength(1);
  });

  it.each(["GOOGLE_PLAY_SUGGEST_REACH", "APPLE_SUGGEST_REACH"] as const)(
    "keeps suggest reach lines for %s",
    (source) => {
      expect(popularitySignalLines(signals(), source, 54)).toEqual([
        "The store suggests it after 2 typed characters, in position 8.",
      ]);
    },
  );

  it("explains the app store estimate without suggest reach", () => {
    expect(
      popularitySignalLines(
        signals({ suggestReach: "absent" }),
        "APPLE_SEARCH_SIGNALS",
      ),
    ).toEqual([
      "Estimated from the first 25 App Store results and search suggestions, on Apple's search popularity scale.",
    ]);
  });

  it("says nothing without signals", () => {
    expect(popularitySignalLines(null)).toEqual([]);
  });
});

describe("difficultySignalLines", () => {
  it.each([
    ["brand", "A brand search: one app dominates this page."],
    ["weak_leader", "The top result has fewer than 100 ratings."],
    ["small_serp", "The store returns three results or fewer."],
    [
      "padded",
      "Few results target this phrase; the page is padded with other apps.",
    ],
  ] as const)("explains the %s flag", (flag, expected) => {
    expect(difficultySignalLines(signals({ flags: [flag] }))).toEqual([
      expected,
    ]);
  });

  it("keeps the declared flag order", () => {
    expect(
      difficultySignalLines(signals({ flags: ["padded", "brand"] })),
    ).toEqual([
      "A brand search: one app dominates this page.",
      "Few results target this phrase; the page is padded with other apps.",
    ]);
  });

  it("describes a typical page without flags", () => {
    expect(difficultySignalLines(signals())).toEqual([
      "Typical top ten app: 45,000 ratings.",
    ]);
  });

  it("counts a median of one rating in the singular", () => {
    expect(difficultySignalLines(signals({ medianRatingCount: 1 }))).toEqual([
      "Typical top ten app: 1 rating.",
    ]);
  });

  it("says nothing without a median or signals", () => {
    expect(difficultySignalLines(signals({ medianRatingCount: null }))).toEqual(
      [],
    );
    expect(difficultySignalLines(null)).toEqual([]);
  });
});

describe("floor answers", () => {
  const SEARCH_MODEL =
    "Estimated from the first 25 App Store results and search suggestions, on Apple's search popularity scale.";
  const floor = (overrides: Partial<ScoreSignals> = {}): ScoreSignals =>
    signals({
      officialPopularity: 41,
      officialPopularityState: "floor",
      officialPopularityFloor: 41,
      officialPopularityWeek: "2026-10-18",
      ...overrides,
    });
  const absent = (overrides: Partial<ScoreSignals> = {}): ScoreSignals =>
    floor({
      officialPopularity: null,
      officialPopularityState: "absent",
      ...overrides,
    });

  it("names the floor value and the last value above it", () => {
    expect(
      popularitySignalLines(
        floor({
          officialPopularityLastAboveFloor: { value: 63, week: "2026-09-06" },
        }),
        "APPLE_ADS_POPULARITY",
      ),
    ).toEqual([
      "Apple answered its floor value (41) for the week of 18 Oct 2026.",
      "The last value above the floor was 63 in the week of 6 Sep 2026.",
    ]);
  });

  it("names only the floor value when no kept week listed the term above it", () => {
    expect(popularitySignalLines(floor(), "APPLE_ADS_POPULARITY")).toEqual([
      "Apple answered its floor value (41) for the week of 18 Oct 2026.",
    ]);
  });

  it("keeps the estimate line for a term Apple left out", () => {
    expect(
      popularitySignalLines(
        absent({
          officialPopularityLastAboveFloor: { value: 58, week: "2026-09-27" },
        }),
        "APPLE_SEARCH_SIGNALS",
        38,
      ),
    ).toEqual([
      SEARCH_MODEL,
      "Apple left this term out of its list for the week of 18 Oct 2026, so its popularity is below the floor of 41 and the number shown is held under it.",
      "The last value above the floor was 58 in the week of 27 Sep 2026.",
    ]);
  });

  it("leaves out the last value of a term Apple never listed above the floor", () => {
    expect(
      popularitySignalLines(absent(), "APPLE_SEARCH_SIGNALS", 30),
    ).toHaveLength(2);
  });

  it("reads a term listed above the floor as before", () => {
    expect(
      popularitySignalLines(
        floor({
          officialPopularity: 71,
          officialPopularityState: "listed",
          officialPopularityFloor: 56,
        }),
        "APPLE_ADS_POPULARITY",
      ),
    ).toEqual(["Apple reports a search popularity of 71 for this term."]);
  });

  it("still names a floor answer without the floor or the week", () => {
    expect(
      popularitySignalLines(
        signals({ officialPopularity: 41, officialPopularityState: "floor" }),
        "APPLE_ADS_POPULARITY",
      ),
    ).toEqual(["Apple answered its floor value."]);
    expect(
      popularitySignalLines(
        signals({ officialPopularityState: "absent" }),
        "APPLE_SEARCH_SIGNALS",
      ),
    ).toEqual([
      SEARCH_MODEL,
      "Apple left this term out of its list, so its popularity is below the floor and the number shown is held under it.",
    ]);
  });

  it("writes the week with the shared UTC date formatter", () => {
    expect(
      popularitySignalLines(floor({ officialPopularityWeek: "2026-03-05" }))[0],
    ).toContain("5 Mar 2026");
  });

  it("prefers the floor lines whatever the source says", () => {
    expect(
      popularitySignalLines(absent(), "GOOGLE_PLAY_SUGGEST_REACH")[1],
    ).toContain("below the floor of 41");
  });
});

describe("lower confidence on a floor answer", () => {
  const DIFFICULTY =
    "Popularity for this term is an Apple floor answer, so the confidence of this row is capped at Medium. Difficulty itself is read from the search results.";
  const OPPORTUNITY =
    "Opportunity is built from popularity, and popularity for this term is an Apple floor answer, so read it with lower confidence.";
  const floor = (overrides: Partial<ScoreSignals> = {}): ScoreSignals =>
    signals({ officialPopularityState: "floor", ...overrides });

  it("adds the difficulty line after the typical page", () => {
    expect(difficultySignalLines(floor())).toEqual([
      "Typical top ten app: 45,000 ratings.",
      DIFFICULTY,
    ]);
  });

  it("adds the difficulty line after the page flags", () => {
    expect(difficultySignalLines(floor({ flags: ["brand"] }))).toEqual([
      "A brand search: one app dominates this page.",
      DIFFICULTY,
    ]);
  });

  it("says only the difficulty line without a median or flags", () => {
    expect(difficultySignalLines(floor({ medianRatingCount: null }))).toEqual([
      DIFFICULTY,
    ]);
  });

  it("says the difficulty line for a term Apple left out", () => {
    expect(
      difficultySignalLines(
        floor({ officialPopularityState: "absent", medianRatingCount: null }),
      ),
    ).toEqual([DIFFICULTY]);
  });

  it("leaves a listed term alone", () => {
    expect(
      difficultySignalLines(floor({ officialPopularityState: "listed" })),
    ).toEqual(["Typical top ten app: 45,000 ratings."]);
  });

  it("names the opportunity line only for a floor answer", () => {
    expect(lowerConfidenceLines("opportunity", floor())).toEqual([OPPORTUNITY]);
    expect(
      lowerConfidenceLines(
        "opportunity",
        floor({ officialPopularityState: "listed" }),
      ),
    ).toEqual([]);
    expect(lowerConfidenceLines("opportunity", null)).toEqual([]);
  });
});

describe("revealLabel", () => {
  it.each([
    [signals({ suggestPrefixLength: 3, suggestPosition: 2 }), "3 letters · #2"],
    [signals({ suggestPrefixLength: 1, suggestPosition: 1 }), "1 letter · #1"],
    [signals({ suggestPrefixLength: null, suggestPosition: 2 }), "Suggested"],
    [signals({ suggestPrefixLength: 2, suggestPosition: null }), "Suggested"],
    [signals({ suggestReach: "listed" }), "Full phrase"],
    [signals({ suggestReach: "absent" }), "Not suggested"],
    [signals({ suggestReach: "unavailable" }), null],
    [null, null],
  ])("labels %# as %s", (value, expected) => {
    expect(revealLabel(value)).toBe(expected);
  });
});

describe("revealRank", () => {
  it("is null for a dash and orders the reveal values from the earliest to the latest", () => {
    const ordered = [
      signals({ suggestPrefixLength: 1, suggestPosition: 5 }),
      signals({ suggestPrefixLength: 2, suggestPosition: 1 }),
      signals({ suggestPrefixLength: 2, suggestPosition: 4 }),
      signals({ suggestPrefixLength: null, suggestPosition: null }),
      signals({ suggestReach: "listed" }),
      signals({ suggestReach: "absent" }),
    ];
    const ranks = ordered.map((value) => revealRank(value));
    expect(ranks.every((rank) => rank !== null)).toBe(true);
    expect(ranks).toEqual([...ranks].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(revealRank(signals({ suggestReach: "unavailable" }))).toBeNull();
    expect(revealRank(null)).toBeNull();
  });

  it("orders a shorter prefix first even when its position is much later", () => {
    const oneLetterLatePosition = revealRank(
      signals({ suggestPrefixLength: 1, suggestPosition: 1002 }),
    );
    const twoLettersFirstPosition = revealRank(
      signals({ suggestPrefixLength: 2, suggestPosition: 1 }),
    );
    expect(oneLetterLatePosition).not.toBeNull();
    expect(twoLettersFirstPosition).not.toBeNull();
    expect(oneLetterLatePosition!).toBeLessThan(twoLettersFirstPosition!);
  });
});

describe("reveal column", () => {
  it("is registered hidden by default and reads the reveal rank of a row", () => {
    const column = revealColumn();
    expect(column.id).toBe("reveal");
    expect(column.meta).toMatchObject({ hiddenByDefault: true });
    const accessor = (
      column as unknown as {
        accessorFn: (row: {
          scoreSignals: ScoreSignals | null;
        }) => number | undefined;
      }
    ).accessorFn;
    expect(
      accessor({ scoreSignals: signals({ suggestReach: "listed" }) }),
    ).toBe(revealRank(signals({ suggestReach: "listed" })) ?? undefined);
    expect(accessor({ scoreSignals: null })).toBeUndefined();
  });

  it("sorts dashes last through the table's undefined handling, as every sortable keyword column does", () => {
    const column = revealColumn() as {
      sortFn?: unknown;
      sortUndefined?: unknown;
    };
    expect(column.sortFn).toBe("basic");
    expect(column.sortUndefined).toBe("last");
    const accessor = (
      column as {
        accessorFn: (row: {
          scoreSignals: ScoreSignals | null;
        }) => number | undefined;
      }
    ).accessorFn;
    const dashes = [
      accessor({ scoreSignals: signals({ suggestReach: "unavailable" }) }),
      accessor({ scoreSignals: null }),
    ];
    expect(dashes).toEqual([undefined, undefined]);
  });
});
