import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  KEYWORD_SORTS,
  KEYWORD_SUGGESTION_STRATEGIES,
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

export const sortParser =
  parseAsStringLiteral(KEYWORD_SORTS).withDefault("opportunity");

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
