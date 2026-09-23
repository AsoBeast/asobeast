import type { ColumnFiltersState } from "@tanstack/react-table";
import type { inferParserType } from "nuqs";
import { BUCKET_LABELS } from "@/components/BucketBadge";
import type { keywordFilterParsers } from "@/lib/search-params";
import { SOURCE_LABELS } from "./SourceBadge";

export type KeywordFilters = inferParserType<typeof keywordFilterParsers>;

export type KeywordFilterKey = keyof KeywordFilters;

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
  ].filter((filter) => filter.value.length > 0 && filter.value !== "all");
}

export interface KeywordFilterChip {
  key: KeywordFilterKey;
  label: string;
}

export function keywordFilterChips(
  filters: KeywordFilters,
): KeywordFilterChip[] {
  const chips: Array<KeywordFilterChip | null> = [
    filters.q ? { key: "q", label: `Search: ${filters.q}` } : null,
    filters.source.length > 0
      ? {
          key: "source",
          label: `Source: ${filters.source.map((source) => SOURCE_LABELS[source]).join(", ")}`,
        }
      : null,
    filters.bucket.length > 0
      ? {
          key: "bucket",
          label: `Bucket: ${filters.bucket.map((bucket) => BUCKET_LABELS[bucket]).join(", ")}`,
        }
      : null,
    filters.status !== "all"
      ? { key: "status", label: `Status: ${STATUS_LABELS[filters.status]}` }
      : null,
  ];
  return chips.filter((chip): chip is KeywordFilterChip => chip !== null);
}
