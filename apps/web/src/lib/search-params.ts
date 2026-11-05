import {
  ALERT_FEED_EVENTS,
  ALL_WORKSPACES,
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  KEYWORD_BUCKETS,
  KEYWORD_CLASSES,
  KEYWORD_SORTS,
  KEYWORD_SOURCES,
  KEYWORD_SUGGESTION_STRATEGIES,
  APP_STORE_LOCALIZATION_IDS,
  CATEGORY_COLLECTIONS,
  CHART_COMPARE_WINDOWS,
  CHART_DEVICES,
  COUNTRY_PATTERN,
  DISCOVERY_STATES,
  OVERALL_GENRE,
  PAID_PLAN_NAMES,
  REVIEW_REPLY_STATES,
  REVIEW_SORTS,
  STORES,
  isUtcCalendarDate,
  type ActionStatus,
} from "@asobeast/shared";
import {
  createLoader,
  createParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  type SingleParser,
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
import { GAP_TABS } from "./gap-lists";
import { GRADES } from "./grade";
import { KEYWORD_ZONES } from "./keyword-zones";
import { POSITION_BANDS, VERSUS, type ActivityStatus } from "./table/facets";

export const planParam = parseAsStringLiteral(PAID_PLAN_NAMES);

export const KEYWORD_TABLE_SORTS = [
  ...KEYWORD_SORTS,
  "keyword",
  "source",
  "delta7d",
  "acquisitions",
] as const;

export const KEYWORD_DEFAULT_SORT = "opportunity";

export const keywordSortParser = parseAsStringLiteral(KEYWORD_TABLE_SORTS);

const parseAsDistinctArrayOf = <Item>(itemParser: SingleParser<Item>) => {
  const list = parseAsArrayOf(itemParser);
  return createParser({
    parse: (value) => {
      const items = list.parse(value);
      return items === null ? null : [...new Set(items)];
    },
    serialize: list.serialize,
    eq: list.eq,
  });
};

export const searchParser = parseAsString.withDefault("");

export const keywordSourceParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(KEYWORD_SOURCES),
).withDefault([]);

export const keywordBucketParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(KEYWORD_BUCKETS),
).withDefault([]);

export const KEYWORD_STATUSES = [
  "all",
  "active",
  "paused",
] as const satisfies readonly ActivityStatus[];

export const keywordStatusParser =
  parseAsStringLiteral(KEYWORD_STATUSES).withDefault("all");

export const gradeFacetParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(GRADES),
).withDefault([]);

export const positionBandParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(POSITION_BANDS),
).withDefault([]);

export const keywordTagsParser = parseAsDistinctArrayOf(
  parseAsString,
).withDefault([]);

export const keywordZoneParser = parseAsStringLiteral(KEYWORD_ZONES);

export const keywordClassParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(KEYWORD_CLASSES),
).withDefault([]);

export const keywordFilterParsers = {
  q: searchParser,
  source: keywordSourceParser,
  bucket: keywordBucketParser,
  status: keywordStatusParser,
  type: keywordClassParser,
  pop: gradeFacetParser,
  diff: gradeFacetParser,
  opp: gradeFacetParser,
  pos: positionBandParser,
  tag: keywordTagsParser,
  zone: keywordZoneParser,
};

export const COMBINATION_WORD_FILTERS = [
  "1",
  "2",
  "3",
] as const satisfies readonly `${CombinationWordCount}`[];

export const combinationWordsParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(COMBINATION_WORD_FILTERS),
).withDefault([]);

export const combinationStatusParser = parseAsDistinctArrayOf(
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

export const countryParser = createParser({
  parse(value) {
    const country = value.toLowerCase();
    return COUNTRY_PATTERN.test(country) ? country : null;
  },
  serialize(value: string) {
    return value;
  },
}).withDefault("");

export const matrixFilterParsers = {
  q: searchParser,
  vs: versusParser,
  country: countryParser,
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

export const KEYWORD_VIEWS = ["table", "map"] as const;

export type KeywordView = (typeof KEYWORD_VIEWS)[number];

export const keywordViewParser =
  parseAsStringLiteral(KEYWORD_VIEWS).withDefault("table");

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

export const adminStoreParser = parseAsDistinctArrayOf(
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

export const keywordIdsParser = parseAsDistinctArrayOf(
  parseAsString,
).withDefault([]);

export type KeywordChartSelection =
  { mode: "chart"; ids: string[] } | { mode: "hidden" };

const toChartSelection = (ids: string[]): KeywordChartSelection => {
  const kept = ids.filter((id) => id !== "");
  return kept.length > 0 ? { mode: "chart", ids: kept } : { mode: "hidden" };
};

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

const sameChartSelection = (
  a: KeywordChartSelection,
  b: KeywordChartSelection,
): boolean => {
  if (a.mode !== b.mode) return false;
  if (a.mode === "chart" && b.mode === "chart") return sameIds(a.ids, b.ids);
  return true;
};

export const keywordChartSelectionParser = createParser({
  parse: (query) => toChartSelection(keywordIdsParser.parse(query) ?? []),
  serialize: (selection) =>
    selection.mode === "chart" ? keywordIdsParser.serialize(selection.ids) : "",
  eq: sameChartSelection,
}).withDefault({ mode: "hidden" });

export const marketParser = parseAsString.withDefault("");

export const onlyGapsParser = parseAsBoolean.withDefault(false);

export const suggestionStrategyParser = parseAsStringLiteral(
  KEYWORD_SUGGESTION_STRATEGIES,
).withDefault("metadata");

export const KEYWORDS_TABS = ["tracked", "discovered"] as const;
export type KeywordsTab = (typeof KEYWORDS_TABS)[number];
export const keywordsTabParser =
  parseAsStringLiteral(KEYWORDS_TABS).withDefault("tracked");

export const discoveryStateParser =
  parseAsStringLiteral(DISCOVERY_STATES).withDefault("all");

export const serpParser = parseAsString.withDefault("");

export const breakdownParser = parseAsString.withDefault("");

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

export const reviewReplyStateParser = parseAsStringLiteral(REVIEW_REPLY_STATES);

export const reviewSinceParser = parseAsStringLiteral(RATINGS_RANGES);

export const reviewSortParser =
  parseAsStringLiteral(REVIEW_SORTS).withDefault("newest");

export const reviewQueryParser = parseAsString.withDefault("");

export const reviewReplyParser = parseAsString;

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

export const actionStatusParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(ACTION_STATUSES),
).withDefault([...ACTION_DEFAULT_STATUSES]);

export const actionPriorityParser = parseAsDistinctArrayOf(
  parseAsStringLiteral(ACTION_PRIORITIES),
).withDefault([]);

export const actionRuleParser = parseAsDistinctArrayOf(
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
  category: parseAsDistinctArrayOf(
    parseAsStringLiteral(ACTION_CATEGORIES),
  ).withDefault([]),
  app: parseAsDistinctArrayOf(parseAsString).withDefault([]),
  market: parseAsDistinctArrayOf(parseAsString).withDefault([]),
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

export const fieldLocaleParser = localizationParser;

export const utcDateParser = createParser({
  parse(value) {
    return isUtcCalendarDate(value) ? value : null;
  },
  serialize(value: string) {
    return value;
  },
});

export const serpDateParser = utcDateParser;

export const CHART_VIEWS = ["columns", "table"] as const;

export type ChartView = (typeof CHART_VIEWS)[number];

export const chartViewParser =
  parseAsStringLiteral(CHART_VIEWS).withDefault("columns");

export const chartParsers = {
  view: chartViewParser,
  store: parseAsStringLiteral(STORES).withDefault("APP_STORE"),
  country: countryParser,
  collection: parseAsStringLiteral(CATEGORY_COLLECTIONS).withDefault("free"),
  genre: parseAsString.withDefault(OVERALL_GENRE),
  device: parseAsStringLiteral(CHART_DEVICES),
  date: utcDateParser,
  compare: parseAsStringLiteral(CHART_COMPARE_WINDOWS).withDefault("1d"),
};

export const loadChartSearch = createLoader(chartParsers);

export const CHART_SORTS = ["position", "movement", "app", "genre"] as const;

export const chartTableParsers = {
  sort: parseAsStringLiteral(CHART_SORTS).withDefault("position"),
  dir: sortDirectionParser,
  q: searchParser,
};

export const alertFeedParsers = {
  app: parseAsString,
  type: parseAsDistinctArrayOf(
    parseAsStringLiteral(ALERT_FEED_EVENTS),
  ).withDefault([]),
  q: searchParser,
};

export const loadAlertFeedSearch = createLoader(alertFeedParsers);

export const gapTabParser = parseAsStringLiteral(GAP_TABS).withDefault("gaps");

export const GAP_SORTS = [
  "keyword",
  "competitor",
  "theirs",
  "yours",
  "popularity",
  "difficulty",
  "opportunity",
  "reason",
  "margin",
] as const;

export const GAP_DEFAULT_SORT = "opportunity";

export const gapSortParser =
  parseAsStringLiteral(GAP_SORTS).withDefault(GAP_DEFAULT_SORT);

export const gapTableParsers = {
  sort: gapSortParser,
  dir: sortDirectionParser,
  q: searchParser,
  country: countryParser,
};

export const GAP_URL_KEYS = {
  sort: "gapSort",
  dir: "gapDir",
  q: "gapQ",
  country: "gapCountry",
} as const satisfies Record<keyof typeof gapTableParsers, string>;

export const VISIBILITY_VIEWS = ["visibility", "share"] as const;

export type VisibilityView = (typeof VISIBILITY_VIEWS)[number];

export const visibilityViewParser =
  parseAsStringLiteral(VISIBILITY_VIEWS).withDefault("visibility");

export const inspectParsers = {
  id: parseAsString,
  keyword: parseAsString.withDefault(""),
  store: parseAsStringLiteral(STORES).withDefault("APP_STORE"),
  country: countryParser,
};
