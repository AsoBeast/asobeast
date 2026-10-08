import {
  ALL_WORKSPACES,
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  KEYWORD_BUCKETS,
  KEYWORD_SORTS,
  KEYWORD_SOURCES,
  KEYWORD_SUGGESTION_STRATEGIES,
  APP_STORE_LOCALIZATION_IDS,
  STORES,
  type ActionStatus,
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
import {
  COMBINATION_STATUSES,
  type CombinationWordCount,
} from "./keyword-combinations";
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

export const keywordTagsParser = parseAsArrayOf(parseAsString).withDefault([]);

export const keywordFilterParsers = {
  q: searchParser,
  source: keywordSourceParser,
  bucket: keywordBucketParser,
  status: keywordStatusParser,
  pop: gradeFacetParser,
  diff: gradeFacetParser,
  opp: gradeFacetParser,
  pos: positionBandParser,
  tag: keywordTagsParser,
};

export const COMBINATION_WORD_FILTERS = [
  "1",
  "2",
  "3",
] as const satisfies readonly `${CombinationWordCount}`[];

export const combinationWordsParser = parseAsArrayOf(
  parseAsStringLiteral(COMBINATION_WORD_FILTERS),
).withDefault([]);

export const combinationStatusParser = parseAsArrayOf(
  parseAsStringLiteral(COMBINATION_STATUSES),
).withDefault([]);

export const combinationParsers = {
  open: parseAsBoolean.withDefault(false),
  q: searchParser,
  words: combinationWordsParser,
  status: combinationStatusParser,
};

export const COMBINATION_URL_KEYS = {
  open: "combos",
  q: "comboQ",
  words: "comboWords",
  status: "comboStatus",
} as const satisfies Record<keyof typeof combinationParsers, string>;

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

export const APP_SORTS = [
  "visibility",
  "change",
  "top10",
  "rating",
  "actions",
  "name",
  "updated",
] as const;

export type AppSort = (typeof APP_SORTS)[number];

export const appSortParser =
  parseAsStringLiteral(APP_SORTS).withDefault("visibility");

export const APP_VIEWS = ["cards", "table"] as const;

export type AppView = (typeof APP_VIEWS)[number];

export const appViewParser =
  parseAsStringLiteral(APP_VIEWS).withDefault("cards");

export const appListParsers = {
  q: searchParser,
  sort: appSortParser,
  dir: sortDirectionParser,
  view: appViewParser,
};

export const ADMIN_WORKSPACE_SORTS = [
  "created",
  "name",
  "plan",
  "members",
  "apps",
  "keywordMarkets",
] as const;

export const adminWorkspaceSortParser = parseAsStringLiteral(
  ADMIN_WORKSPACE_SORTS,
).withDefault("created");

export const adminWorkspaceListParsers = {
  q: searchParser,
  sort: adminWorkspaceSortParser,
  dir: sortDirectionParser,
};

export const ADMIN_USER_SORTS = [
  "joined",
  "email",
  "role",
  "workspace",
  "plan",
] as const;

export const adminUserSortParser =
  parseAsStringLiteral(ADMIN_USER_SORTS).withDefault("joined");

const WORKSPACE_ID_MAX = 64;

export const adminWorkspaceParser = createParser({
  parse: (value) =>
    value.length > 0 &&
    value.length <= WORKSPACE_ID_MAX &&
    value !== ALL_WORKSPACES
      ? value
      : null,
  serialize: (value: string) => value,
});

export const adminUserListParsers = {
  q: searchParser,
  workspace: adminWorkspaceParser,
  sort: adminUserSortParser,
  dir: sortDirectionParser,
};

export const ADMIN_APP_SORTS = [
  "added",
  "name",
  "store",
  "market",
  "workspace",
  "competitors",
  "keywordMarkets",
] as const;

export const adminAppSortParser =
  parseAsStringLiteral(ADMIN_APP_SORTS).withDefault("added");

export const adminStoreParser = parseAsArrayOf(
  parseAsStringLiteral(STORES),
).withDefault([]);

export const adminAppListParsers = {
  q: searchParser,
  workspace: adminWorkspaceParser,
  store: adminStoreParser,
  sort: adminAppSortParser,
  dir: sortDirectionParser,
};

export const rangeParser =
  parseAsStringLiteral(RANGE_PRESETS).withDefault("30d");

export const visibilityRangeParser =
  parseAsStringLiteral(VISIBILITY_RANGES).withDefault("30d");

export const overviewRangeParsers = {
  range: visibilityRangeParser,
  distRange: visibilityRangeParser,
  categoryRange: rangeParser,
};

export const keywordIdsParser = parseAsArrayOf(parseAsString).withDefault([]);

export const countryParser = parseAsString.withDefault("");

export const marketParser = parseAsString.withDefault("");

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

export const rankingsRangeParsers = {
  range: rangeParser,
  movers: moverDaysParser,
};

export const ACTION_DEFAULT_STATUSES = [
  "OPEN",
  "SNOOZED",
] as const satisfies readonly ActionStatus[];

export const actionStatusParser = parseAsArrayOf(
  parseAsStringLiteral(ACTION_STATUSES),
).withDefault([...ACTION_DEFAULT_STATUSES]);

export const actionPriorityParser = parseAsArrayOf(
  parseAsStringLiteral(ACTION_PRIORITIES),
).withDefault([]);

export const actionRuleParser = parseAsArrayOf(
  parseAsStringLiteral(ACTION_RULES),
).withDefault([]);

export const ACTION_GROUPS = ["priority", "app", "category"] as const;
export type ActionGroup = (typeof ACTION_GROUPS)[number];

export const ACTION_SORTS = ["impact", "newest", "oldest"] as const;
export type ActionSort = (typeof ACTION_SORTS)[number];

export const actionQueueParsers = {
  status: actionStatusParser,
  priority: actionPriorityParser,
  rule: actionRuleParser,
  category: parseAsArrayOf(parseAsStringLiteral(ACTION_CATEGORIES)).withDefault(
    [],
  ),
  app: parseAsArrayOf(parseAsString).withDefault([]),
  market: parseAsArrayOf(parseAsString).withDefault([]),
  store: parseAsStringLiteral(STORES),
  q: parseAsString.withDefault(""),
  group: parseAsStringLiteral(ACTION_GROUPS).withDefault("priority"),
  sort: parseAsStringLiteral(ACTION_SORTS).withDefault("impact"),
};

export const actionFocusParser = parseAsString.withDefault("");

export const CHANGE_OWNERS = ["all", "yours", "competitors"] as const;

export type ChangeOwner = (typeof CHANGE_OWNERS)[number];

export const changeOwnerParser =
  parseAsStringLiteral(CHANGE_OWNERS).withDefault("all");

export const mcpClientParser =
  parseAsStringLiteral(MCP_CLIENTS).withDefault(DEFAULT_MCP_CLIENT);

export const localizationParser = parseAsStringLiteral(
  APP_STORE_LOCALIZATION_IDS,
);

export const draftLocaleParser = localizationParser;
