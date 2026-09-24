import type { ColumnFiltersState } from "@tanstack/react-table";
import type { inferParserType } from "nuqs";
import { BUCKET_LABELS } from "@/components/BucketBadge";
import { gradeLabel } from "@/lib/grade";
import type { keywordFilterParsers } from "@/lib/search-params";
import { POSITION_BAND_LABELS } from "@/lib/table/facets";
import { SOURCE_LABELS } from "./SourceBadge";

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
): ColumnFiltersState {
  return [
    { id: "source", value: filters.source },
    { id: "bucket", value: filters.bucket },
    { id: "status", value: filters.status },
    { id: "traffic", value: filters.pop },
    { id: "difficulty", value: filters.diff },
    { id: "opportunity", value: filters.opp },
    { id: "position", value: filters.pos },
  ].filter((filter) => filter.value.length > 0 && filter.value !== "all");
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
    filters.q ? { key: "q" as const, label: `Search: ${filters.q}` } : null,
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
    listChip("pop", "Popularity", filters.pop, gradeLabel),
    listChip("diff", "Difficulty", filters.diff, gradeLabel),
    listChip("opp", "Opportunity", filters.opp, gradeLabel),
    listChip(
      "pos",
      "Position",
      filters.pos,
      (value) => POSITION_BAND_LABELS[value],
    ),
  ];
  return chips.filter((chip) => chip !== null);
}
