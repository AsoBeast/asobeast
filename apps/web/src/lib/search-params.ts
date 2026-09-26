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
import {
  createParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import {
  CHANGE_WINDOWS,
  DISCOVERY_WINDOWS,
  MOVER_WINDOWS,
  RANGE_PRESETS,
  RATINGS_RANGES,
  VISIBILITY_RANGES,
  type ChangeWindow,
  type DiscoveryWindow,
  type MoverWindow,
} from "./ranges";
import { DEFAULT_MCP_CLIENT, MCP_CLIENTS } from "./mcp-snippets";
import { GRADES } from "./grade";
import { POSITION_BANDS, VERSUS, type ActivityStatus } from "./table/facets";

export const KEYWORD_TABLE_SORTS = [
  ...KEYWORD_SORTS,
  "keyword",
  "source",
  "delta7d",
] as const;

export const keywordSortParser =
  parseAsStringLiteral(KEYWORD_TABLE_SORTS).withDefault("opportunity");

export const searchParser = parseAsString.withDefault("");

export const keywordSourceParser = parseAsArrayOf(
  parseAsStringLiteral(KEYWORD_SOURCES),
).withDefault([]);

export const keywordBucketParser = parseAsArrayOf(
  parseAsStringLiteral(KEYWORD_BUCKETS),
).withDefault([]);

export const KEYWORD_STATUSES = [
  "all",
  "active",
  "paused",
] as const satisfies readonly ActivityStatus[];

export const keywordStatusParser =
  parseAsStringLiteral(KEYWORD_STATUSES).withDefault("all");

export const gradeFacetParser = parseAsArrayOf(
  parseAsStringLiteral(GRADES),
).withDefault([]);

export const positionBandParser = parseAsArrayOf(
  parseAsStringLiteral(POSITION_BANDS),
).withDefault([]);

export const keywordFilterParsers = {
  q: searchParser,
  source: keywordSourceParser,
  bucket: keywordBucketParser,
  status: keywordStatusParser,
  pop: gradeFacetParser,
  diff: gradeFacetParser,
  opp: gradeFacetParser,
  pos: positionBandParser,
};

export const matrixSortParser = parseAsString;

export const VERSUS_FILTERS = ["all", ...VERSUS] as const;

export const versusParser =
  parseAsStringLiteral(VERSUS_FILTERS).withDefault("all");

export const matrixFilterParsers = {
  q: searchParser,
  vs: versusParser,
};

export const DISCOVERY_SORTS = [
  "app",
  "appearances",
  "keywords",
  "best",
  "avg",
  "rating",
] as const;

export const discoverySortParser =
  parseAsStringLiteral(DISCOVERY_SORTS).withDefault("appearances");

export const COVERAGE_SORTS = ["keyword", "bucket"] as const;

export const coverageSortParser = parseAsStringLiteral(COVERAGE_SORTS);

export const coverageFilterParsers = {
  q: searchParser,
  uncovered: parseAsBoolean.withDefault(false),
};

export const SORT_DIRECTIONS = ["asc", "desc"] as const;

export const sortDirectionParser = parseAsStringLiteral(SORT_DIRECTIONS);

export const rangeParser =
  parseAsStringLiteral(RANGE_PRESETS).withDefault("30d");

export const visibilityRangeParser =
  parseAsStringLiteral(VISIBILITY_RANGES).withDefault("30d");

export const keywordIdsParser = parseAsArrayOf(parseAsString).withDefault([]);

export const countryParser = parseAsString.withDefault("");

export const onlyGapsParser = parseAsBoolean.withDefault(false);

export const suggestionStrategyParser = parseAsStringLiteral(
  KEYWORD_SUGGESTION_STRATEGIES,
).withDefault("metadata");

export const serpParser = parseAsString.withDefault("");

export const spiderTermParser = parseAsString.withDefault("");

export const ratingsRangeParser =
  parseAsStringLiteral(RATINGS_RANGES).withDefault("30d");

export const reviewScoreParser = createParser({
  parse(value) {
    const score = Number(value);
    return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
  },
  serialize(value: number) {
    return String(value);
  },
});

export const reviewVersionParser = parseAsString.withDefault("");

export const discoveryDaysParser = createParser({
  parse(value) {
    const days = Number(value);
    return (DISCOVERY_WINDOWS as readonly number[]).includes(days)
      ? (days as DiscoveryWindow)
      : null;
  },
  serialize(value: DiscoveryWindow) {
    return String(value);
  },
}).withDefault(30);

export const changeDaysParser = createParser({
  parse(value) {
    const days = Number(value);
    return (CHANGE_WINDOWS as readonly number[]).includes(days)
      ? (days as ChangeWindow)
      : null;
  },
  serialize(value: ChangeWindow) {
    return String(value);
  },
}).withDefault(90);

export const moverDaysParser = createParser({
  parse(value) {
    const days = Number(value);
    return (MOVER_WINDOWS as readonly number[]).includes(days)
      ? (days as MoverWindow)
      : null;
  },
  serialize(value: MoverWindow) {
    return String(value);
  },
}).withDefault(7);

export const actionStatusParser = parseAsArrayOf(
  parseAsStringLiteral(ACTION_STATUSES),
).withDefault(["OPEN", "SNOOZED"]);

export const actionPriorityParser = parseAsArrayOf(
  parseAsStringLiteral(ACTION_PRIORITIES),
).withDefault([]);

export const actionRuleParser = parseAsArrayOf(
  parseAsStringLiteral(ACTION_RULES),
).withDefault([]);

export const actionCategoryParser = parseAsStringLiteral(ACTION_CATEGORIES);

export const actionAppParser = parseAsString.withDefault("");

export const actionFocusParser = parseAsString.withDefault("");

export const mcpClientParser =
  parseAsStringLiteral(MCP_CLIENTS).withDefault(DEFAULT_MCP_CLIENT);

export const draftLocaleParser = parseAsStringLiteral(
  APP_STORE_LOCALIZATION_IDS,
);
