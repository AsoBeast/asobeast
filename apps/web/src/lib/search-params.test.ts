import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  KEYWORD_BUCKETS,
  KEYWORD_SORTS,
  KEYWORD_SOURCES,
  KEYWORD_SUGGESTION_STRATEGIES,
  APP_STORE_LOCALIZATION_IDS,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  COMBINATION_STATUSES,
  COMBINATION_WORD_COUNTS,
} from "./keyword-combinations";
import {
  CHANGE_WINDOWS,
  DISCOVERY_WINDOWS,
  MOVER_WINDOWS,
  RANGE_PRESETS,
  RATINGS_RANGES,
  VISIBILITY_RANGES,
} from "./ranges";
import { DEFAULT_MCP_CLIENT, MCP_CLIENTS } from "./mcp-snippets";
import { GRADES } from "./grade";
import { POSITION_BANDS } from "./table/facets";
import {
  COMBINATION_URL_KEYS,
  COMBINATION_WORD_FILTERS,
  combinationParsers,
  combinationStatusParser,
  combinationWordsParser,
  keywordFilterParsers,
  draftLocaleParser,
  actionCategoryParser,
  actionPriorityParser,
  actionRuleParser,
  actionStatusParser,
  changeDaysParser,
  countryParser,
  discoveryDaysParser,
  KEYWORD_STATUSES,
  KEYWORD_TABLE_SORTS,
  COVERAGE_SORTS,
  coverageSortParser,
  DISCOVERY_SORTS,
  discoverySortParser,
  gradeFacetParser,
  matrixSortParser,
  positionBandParser,
  VERSUS_FILTERS,
  versusParser,
  keywordBucketParser,
  keywordIdsParser,
  keywordSourceParser,
  keywordStatusParser,
  keywordSortParser,
  keywordTagsParser,
  mcpClientParser,
  moverDaysParser,
  onlyGapsParser,
  rangeParser,
  ratingsRangeParser,
  reviewScoreParser,
  searchParser,
  serpParser,
  SORT_DIRECTIONS,
  sortDirectionParser,
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
  ["keywordSort", keywordSortParser, KEYWORD_TABLE_SORTS, "opportunity"],
  ["range", rangeParser, RANGE_PRESETS, "30d"],
  ["visibilityRange", visibilityRangeParser, VISIBILITY_RANGES, "30d"],
  ["ratingsRange", ratingsRangeParser, RATINGS_RANGES, "30d"],
  [
    "suggestionStrategy",
    suggestionStrategyParser,
    KEYWORD_SUGGESTION_STRATEGIES,
    "metadata",
  ],
  ["mcpClient", mcpClientParser, MCP_CLIENTS, DEFAULT_MCP_CLIENT],
  ["keywordStatus", keywordStatusParser, KEYWORD_STATUSES, "all"],
  ["versus", versusParser, VERSUS_FILTERS, "all"],
  ["discoverySort", discoverySortParser, DISCOVERY_SORTS, "appearances"],
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
  ["keywordSource", keywordSourceParser, KEYWORD_SOURCES, []],
  ["keywordBucket", keywordBucketParser, KEYWORD_BUCKETS, []],
  ["gradeFacet", gradeFacetParser, GRADES, []],
  ["positionBand", positionBandParser, POSITION_BANDS, []],
  ["combinationWords", combinationWordsParser, COMBINATION_WORD_FILTERS, []],
  ["combinationStatus", combinationStatusParser, COMBINATION_STATUSES, []],
] as const;

const STRING_PARSERS = [
  ["country", countryParser],
  ["serp", serpParser],
  ["spiderTerm", spiderTermParser],
  ["search", searchParser],
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

describe("sortDirection parser", () => {
  it.each(SORT_DIRECTIONS)("round-trips %s", (direction) => {
    expect(
      sortDirectionParser.parse(sortDirectionParser.serialize(direction)),
    ).toBe(direction);
  });

  it("rejects an unknown direction rather than defaulting to one", () => {
    expect(sortDirectionParser.parseServerSide("up")).toBeNull();
  });
});

describe("keywordSort parser", () => {
  it.each(["keyword", "source", "delta7d", ...KEYWORD_SORTS])(
    "accepts the table sort %s",
    (sort) => {
      expect(keywordSortParser.parseServerSide(sort)).toBe(sort);
    },
  );
});

describe("search parser", () => {
  it("keeps surrounding spaces rather than trimming the search", () => {
    expect(searchParser.parseServerSide(" pomo ")).toBe(" pomo ");
  });
});

describe("matrixSort parser", () => {
  it("keeps a competitor column id", () => {
    expect(matrixSortParser.parseServerSide("c:comp-1")).toBe("c:comp-1");
  });

  it("keeps the api order when nothing is named", () => {
    expect(matrixSortParser.parseServerSide(undefined)).toBeNull();
  });
});

describe("coverageSort parser", () => {
  it.each(COVERAGE_SORTS)("accepts the column %s", (sort) => {
    expect(coverageSortParser.parseServerSide(sort)).toBe(sort);
  });

  it("keeps the api order when nothing or something unknown is named", () => {
    expect(coverageSortParser.parseServerSide(undefined)).toBeNull();
    expect(coverageSortParser.parseServerSide("title")).toBeNull();
  });
});

describe("combination parsers", () => {
  it("offer one word count filter per combination size", () => {
    expect([...COMBINATION_WORD_FILTERS]).toEqual(
      COMBINATION_WORD_COUNTS.map(String),
    );
  });

  it("use address keys no other keyword monitor control uses", () => {
    const taken = new Set([
      ...Object.keys(keywordFilterParsers),
      "country",
      "sort",
      "dir",
      "serp",
      "strategy",
      "spider",
    ]);
    const keys = Object.values(COMBINATION_URL_KEYS);
    expect(new Set(keys).size).toBe(Object.keys(combinationParsers).length);
    expect(keys.filter((key) => taken.has(key))).toEqual([]);
  });
});

describe("keyword tags parser", () => {
  it("reads a comma list of tags and defaults to none", () => {
    expect(keywordTagsParser.parseServerSide("core,brand")).toEqual([
      "core",
      "brand",
    ]);
    expect(keywordTagsParser.parseServerSide(undefined)).toEqual([]);
  });
});

describe("draftLocale parser", () => {
  it.each(APP_STORE_LOCALIZATION_IDS)("accepts the localization %s", (id) => {
    expect(draftLocaleParser.parseServerSide(id)).toBe(id);
  });

  it("drafts the primary listing for a missing, miscased or unknown value", () => {
    expect(draftLocaleParser.parseServerSide(undefined)).toBeNull();
    expect(draftLocaleParser.parseServerSide("es-mx")).toBeNull();
    expect(draftLocaleParser.parseServerSide("xx")).toBeNull();
  });
});
