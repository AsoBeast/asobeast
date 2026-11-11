import type { ColumnFiltersState, FilterFn } from "@tanstack/react-table";
import type { inferParserType } from "nuqs";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { BUCKET_LABELS } from "@/components/BucketBadge";
import { gradeLabel } from "@/lib/grade";
import { MOVE_FILTER_LABELS } from "@/lib/keyword-day-change";
import {
  ZONE_LABELS,
  zoneOf,
  type ZoneFilterValue,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import type { keywordFilterParsers } from "@/lib/search-params";
import { POSITION_BAND_LABELS } from "@/lib/table/facets";
import { KEYWORD_CLASS_LABELS } from "./keyword-class";
import { matchesKeywordSearch, parseKeywordSearch } from "./keyword-search";
import { scorePair } from "@/lib/keyword-scores";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { SOURCE_LABELS } from "./SourceLabel";

export type KeywordFilters = inferParserType<typeof keywordFilterParsers>;

export type KeywordFilterKey = keyof KeywordFilters;

export interface KeywordFilterChip {
  key: KeywordFilterKey;
  label: string;
}

export const STATUS_LABELS: Record<KeywordFilters["status"], string> = {
  all: "All statuses",
  active: "Active",
  paused: "Paused",
};

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

function listChip<T>(
  key: KeywordFilterKey,
  title: string,
  values: readonly T[],
  label: (value: T) => string,
): KeywordFilterChip | null {
  return values.length > 0
    ? { key, label: `${title}: ${values.map(label).join(", ")}` }
    : null;
}

export function keywordFilterChips(
  filters: KeywordFilters,
): KeywordFilterChip[] {
  const chips = [
    filters.q ? { key: "q" as const, label: searchChipLabel(filters.q) } : null,
    listChip(
      "source",
      "Source",
      filters.source,
      (value) => SOURCE_LABELS[value],
    ),
    listChip(
      "bucket",
      "Bucket",
      filters.bucket,
      (value) => BUCKET_LABELS[value],
    ),
    filters.status !== "all"
      ? {
          key: "status" as const,
          label: `Status: ${STATUS_LABELS[filters.status]}`,
        }
      : null,
    listChip(
      "type",
      "Type",
      filters.type,
      (value) => KEYWORD_CLASS_LABELS[value],
    ),
    listChip("pop", "Popularity", filters.pop, gradeLabel),
    listChip("diff", "Difficulty", filters.diff, gradeLabel),
    listChip("opp", "Opportunity", filters.opp, gradeLabel),
    listChip(
      "pos",
      "Position",
      filters.pos,
      (value) => POSITION_BAND_LABELS[value],
    ),
    listChip("tag", "Tag", filters.tag, (value) => value),
    filters.zone === null
      ? null
      : { key: "zone" as const, label: `Zone: ${ZONE_LABELS[filters.zone]}` },
    filters.change === null
      ? null
      : {
          key: "change" as const,
          label: `Since yesterday: ${MOVE_FILTER_LABELS[filters.change]}`,
        },
  ];
  return chips.filter((chip) => chip !== null);
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

export function searchChipLabel(q: string): string {
  const search = parseKeywordSearch(q);
  return search.kind === "exact"
    ? `Exact phrase: ${search.phrase}`
    : `Search: ${q}`;
}

export function exactSearchEmptyBody(q: string): string | undefined {
  const search = parseKeywordSearch(q);
  return search.kind === "exact"
    ? `No keyword is exactly "${search.phrase}" with these filters. Remove the quotes to match keywords that contain it.`
    : undefined;
}
