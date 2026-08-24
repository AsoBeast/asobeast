import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  KEYWORD_SORTS,
  KEYWORD_SUGGESTION_STRATEGIES,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  CHANGE_WINDOWS,
  DISCOVERY_WINDOWS,
  MOVER_WINDOWS,
  RANGE_PRESETS,
  RATINGS_RANGES,
  VISIBILITY_RANGES,
} from "./ranges";
import {
  actionCategoryParser,
  actionPriorityParser,
  actionRuleParser,
  actionStatusParser,
  changeDaysParser,
  countryParser,
  discoveryDaysParser,
  keywordIdsParser,
  moverDaysParser,
  onlyGapsParser,
  rangeParser,
  ratingsRangeParser,
  reviewScoreParser,
  serpParser,
  sortParser,
  spiderTermParser,
  suggestionStrategyParser,
  visibilityRangeParser,
} from "./search-params";

interface LiteralParser {
  defaultValue: string;
  parse(value: string): string | null;
  serialize(value: string): string;
  parseServerSide(value: string | string[] | undefined): string;
}

type LiteralParserCase = readonly [
  string,
  LiteralParser,
  readonly string[],
  string,
];

const LITERAL_PARSERS: readonly LiteralParserCase[] = [
  ["sort", sortParser, KEYWORD_SORTS, "opportunity"],
  ["range", rangeParser, RANGE_PRESETS, "30d"],
  ["visibilityRange", visibilityRangeParser, VISIBILITY_RANGES, "30d"],
  ["ratingsRange", ratingsRangeParser, RATINGS_RANGES, "30d"],
  [
    "suggestionStrategy",
    suggestionStrategyParser,
    KEYWORD_SUGGESTION_STRATEGIES,
    "metadata",
  ],
] as const;

const NUMERIC_PARSERS = [
  ["discoveryDays", discoveryDaysParser, DISCOVERY_WINDOWS, 30],
  ["changeDays", changeDaysParser, CHANGE_WINDOWS, 90],
  ["moverDays", moverDaysParser, MOVER_WINDOWS, 7],
] as const;

const LIST_PARSERS = [
  ["actionStatus", actionStatusParser, ACTION_STATUSES, ["OPEN", "SNOOZED"]],
  ["actionPriority", actionPriorityParser, ACTION_PRIORITIES, []],
  ["actionRule", actionRuleParser, ACTION_RULES, []],
] as const;

const STRING_PARSERS = [
  ["country", countryParser],
  ["serp", serpParser],
  ["spiderTerm", spiderTermParser],
] as const;

describe.each(LITERAL_PARSERS)(
  "%s parser",
  (_name, parser, members, expectedDefault) => {
    it("defaults to the documented value", () => {
      expect(parser.defaultValue).toBe(expectedDefault);
    });

    it.each(members)("round-trips the union member %s", (member) => {
      expect(parser.parse(parser.serialize(member))).toBe(member);
    });

    it.each(members)("accepts the union member %s from the url", (member) => {
      expect(parser.parseServerSide(member)).toBe(member);
    });

    it("falls back to the default for an unknown value", () => {
      expect(parser.parseServerSide("not-a-member")).toBe(expectedDefault);
    });

    it("returns null rather than throwing for an unknown value", () => {
      expect(parser.parse("not-a-member")).toBeNull();
    });

    it("falls back to the default for a missing value", () => {
      expect(parser.parseServerSide(undefined)).toBe(expectedDefault);
    });
  },
);

describe.each(NUMERIC_PARSERS)(
  "%s parser",
  (_name, parser, windows, expectedDefault) => {
    it("defaults to the documented window", () => {
      expect(parser.defaultValue).toBe(expectedDefault);
    });

    it.each(windows)("accepts the window %s", (window) => {
      expect(parser.parseServerSide(String(window))).toBe(window);
    });

    it.each(["0", "45", "not-a-number", ""])(
      "falls back to the default for %s",
      (value) => {
        expect(parser.parseServerSide(value)).toBe(expectedDefault);
      },
    );
  },
);

describe.each(LIST_PARSERS)(
  "%s parser",
  (_name, parser, members, expectedDefault) => {
    it("defaults to the documented selection", () => {
      expect(parser.defaultValue).toEqual(expectedDefault);
    });

    it("accepts every union member at once", () => {
      expect(parser.parseServerSide(members.join(","))).toEqual([...members]);
    });

    it("drops an unknown member rather than the whole selection", () => {
      expect(parser.parseServerSide(`${members[0]},not-a-member`)).toEqual([
        members[0],
      ]);
    });

    it("falls back to the default for a missing value", () => {
      expect(parser.parseServerSide(undefined)).toEqual(expectedDefault);
    });
  },
);

describe.each(STRING_PARSERS)("%s parser", (_name, parser) => {
  it("defaults to an empty selection", () => {
    expect(parser.defaultValue).toBe("");
  });

  it("keeps a value verbatim", () => {
    expect(parser.parseServerSide("fitness tracker")).toBe("fitness tracker");
  });

  it("falls back to the default for a missing value", () => {
    expect(parser.parseServerSide(undefined)).toBe("");
  });
});

describe("keywordIds parser", () => {
  it("defaults to an empty list", () => {
    expect(keywordIdsParser.defaultValue).toEqual([]);
  });

  it("keeps the order of the selected ids", () => {
    expect(keywordIdsParser.parseServerSide("kw-2,kw-1")).toEqual([
      "kw-2",
      "kw-1",
    ]);
  });
});

describe("onlyGaps parser", () => {
  it("defaults to showing everything", () => {
    expect(onlyGapsParser.defaultValue).toBe(false);
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("parses %s", (value, expected) => {
    expect(onlyGapsParser.parseServerSide(value)).toBe(expected);
  });

  it("falls back to the default for a non-boolean value", () => {
    expect(onlyGapsParser.parseServerSide("yes")).toBe(false);
  });
});

describe("reviewScore parser", () => {
  it.each([1, 2, 3, 4, 5])("accepts the star rating %s", (score) => {
    expect(reviewScoreParser.parseServerSide(String(score))).toBe(score);
  });

  it.each(["0", "6", "3.5", "not-a-number"])(
    "rejects the out of range value %s",
    (value) => {
      expect(reviewScoreParser.parseServerSide(value)).toBeNull();
    },
  );
});

describe("actionCategory parser", () => {
  it.each(ACTION_CATEGORIES)("accepts the category %s", (category) => {
    expect(actionCategoryParser.parseServerSide(category)).toBe(category);
  });

  it("rejects an unknown category rather than defaulting to one", () => {
    expect(actionCategoryParser.parseServerSide("not-a-category")).toBeNull();
  });
});
