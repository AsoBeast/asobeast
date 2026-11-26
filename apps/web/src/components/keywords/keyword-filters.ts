import type { ColumnFiltersState, FilterFn } from "@tanstack/react-table";
import type { inferParserType } from "nuqs";
import { createTranslator } from "next-intl";
import type {
  KeywordBucket,
  KeywordClass,
  KeywordSource,
  TrackedKeywordItem,
} from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatListInLocale } from "@/lib/format";
import { gradeLabelInLocale, type Grade } from "@/lib/grade";
import { moveFilterLabel } from "@/lib/keyword-day-change";
import {
  zoneLabel,
  zoneOf,
  type ZoneFilterValue,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import type { Locale } from "@/lib/locale";
import type { PositionBand } from "@/lib/table/facets";
import type { keywordFilterParsers } from "@/lib/search-params";
import { keywordClassLabel } from "./keyword-class";
import { matchesKeywordSearch, parseKeywordSearch } from "./keyword-search";
import { scorePair } from "@/lib/keyword-scores";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { sourceLabel } from "./SourceLabel";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export type KeywordFilters = inferParserType<typeof keywordFilterParsers>;

export type KeywordFilterKey = keyof KeywordFilters;

export interface KeywordFilterChip {
  key: KeywordFilterKey;
  label: string;
}

export const STATUS_LABELS: Record<KeywordFilters["status"], string> = {
  all: enKeywords.filters.all,
  active: enKeywords.filters.active,
  paused: enKeywords.filters.paused,
};

export function statusLabel(
  status: KeywordFilters["status"],
  t: MessageTranslator = english,
): string {
  return t(`filters.${status}`);
}

export function bucketLabel(
  bucket: KeywordBucket,
  t: MessageTranslator = english,
): string {
  return t(`buckets.${bucket}`);
}

export function positionBandLabel(
  band: PositionBand,
  t: MessageTranslator = english,
): string {
  return t(`positionBands.${band}`);
}

export function keywordColumnFilters(
  filters: KeywordFilters,
  thresholds: ZoneThresholds,
): ColumnFiltersState {
  const listed = [
    { id: "source", value: filters.source },
    { id: "bucket", value: filters.bucket },
    { id: "status", value: filters.status },
    { id: "type", value: filters.type },
    { id: "traffic", value: filters.pop },
    { id: "difficulty", value: filters.diff },
    { id: "opportunity", value: filters.opp },
    { id: "position", value: filters.pos },
    { id: "tags", value: filters.tag },
  ].filter((filter) => filter.value.length > 0 && filter.value !== "all");
  return [
    ...listed,
    ...(filters.zone === null
      ? []
      : [{ id: "zone", value: { zone: filters.zone, thresholds } }]),
    ...(filters.change === null
      ? []
      : [{ id: "change", value: filters.change }]),
  ];
}

function joinedValues(values: readonly string[], locale: Locale): string {
  return locale === "en"
    ? values.join(", ")
    : formatListInLocale(values, locale);
}

export function keywordFilterChips(
  filters: KeywordFilters,
  t: MessageTranslator = english,
  locale: Locale = "en",
): KeywordFilterChip[] {
  function listChip<T>(
    key: KeywordFilterKey,
    title: string,
    values: readonly T[],
    label: (value: T) => string,
  ): KeywordFilterChip | null {
    return values.length > 0
      ? {
          key,
          label: t("filters.listChip", {
            title,
            values: joinedValues(values.map(label), locale),
          }),
        }
      : null;
  }

  const chips = [
    filters.q
      ? { key: "q" as const, label: searchChipLabel(filters.q, t) }
      : null,
    listChip(
      "source",
      t("filters.source"),
      filters.source,
      (value: KeywordSource) => sourceLabel(value, t),
    ),
    listChip(
      "bucket",
      t("filters.bucket"),
      filters.bucket,
      (value: KeywordBucket) => bucketLabel(value, t),
    ),
    filters.status !== "all"
      ? {
          key: "status" as const,
          label: t("filters.listChip", {
            title: t("filters.status"),
            values: statusLabel(filters.status, t),
          }),
        }
      : null,
    listChip("type", t("filters.type"), filters.type, (value: KeywordClass) =>
      keywordClassLabel(value, t),
    ),
    listChip("pop", t("filters.popularity"), filters.pop, (value: Grade) =>
      gradeLabelInLocale(value, locale),
    ),
    listChip("diff", t("filters.difficulty"), filters.diff, (value: Grade) =>
      gradeLabelInLocale(value, locale),
    ),
    listChip("opp", t("filters.opportunity"), filters.opp, (value: Grade) =>
      gradeLabelInLocale(value, locale),
    ),
    listChip("pos", t("filters.position"), filters.pos, (value: PositionBand) =>
      positionBandLabel(value, t),
    ),
    listChip("tag", t("filters.tag"), filters.tag, (value) => value),
    filters.zone === null
      ? null
      : {
          key: "zone" as const,
          label: t("filters.zoneChip", {
            zone: zoneLabel(filters.zone, t),
          }),
        },
    filters.change === null
      ? null
      : {
          key: "change" as const,
          label: t("filters.sinceYesterdayChip", {
            change: moveFilterLabel(filters.change, t),
          }),
        },
  ];
  return chips.filter((chip): chip is KeywordFilterChip => chip !== null);
}

export function tagOptions(
  present: Iterable<string>,
  selected: readonly string[],
): { value: string; label: string }[] {
  return [...new Set([...present, ...selected])]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
}

export const keywordSearchFilter: FilterFn<
  KeywordTableFeatures,
  TrackedKeywordItem
> = (row, columnId, value: string) =>
  matchesKeywordSearch(
    row.getValue<string>(columnId),
    parseKeywordSearch(value),
  );

export const keywordZoneFilter: FilterFn<
  KeywordTableFeatures,
  TrackedKeywordItem
> = (row, _columnId, { zone, thresholds }: ZoneFilterValue) =>
  zoneOf(scorePair(row.original), thresholds) === zone;

export function searchChipLabel(
  q: string,
  t: MessageTranslator = english,
): string {
  const search = parseKeywordSearch(q);
  return search.kind === "exact"
    ? t("filters.exactChip", { phrase: search.phrase })
    : t("filters.searchChip", { query: q });
}

export function exactSearchEmptyBody(
  q: string,
  t: MessageTranslator = english,
): string | undefined {
  const search = parseKeywordSearch(q);
  return search.kind === "exact"
    ? t("filters.exactEmpty", { phrase: search.phrase })
    : undefined;
}
