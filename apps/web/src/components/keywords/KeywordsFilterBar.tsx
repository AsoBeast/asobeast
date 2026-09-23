"use client";

import { Download } from "lucide-react";
import type { SetValues } from "nuqs";
import type { Table } from "@tanstack/react-table";
import {
  KEYWORD_BUCKETS,
  KEYWORD_SOURCES,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { BUCKET_LABELS } from "@/components/BucketBadge";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { Button } from "@/components/ui/button";
import {
  KEYWORD_STATUSES,
  type keywordFilterParsers,
} from "@/lib/search-params";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import {
  keywordFilterChips,
  STATUS_LABELS,
  type KeywordFilters,
} from "./keyword-filters";
import { SOURCE_LABELS } from "./SourceBadge";

const SOURCE_OPTIONS = KEYWORD_SOURCES.map((value) => ({
  value,
  label: SOURCE_LABELS[value],
}));

const BUCKET_OPTIONS = KEYWORD_BUCKETS.map((value) => ({
  value,
  label: BUCKET_LABELS[value],
}));

const STATUS_OPTIONS = KEYWORD_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

export function KeywordsFilterBar({
  appId,
  table,
  filters,
  setFilters,
}: {
  appId: string;
  table: Table<KeywordTableFeatures, TrackedKeywordItem>;
  filters: KeywordFilters;
  setFilters: SetValues<typeof keywordFilterParsers>;
}) {
  const shown = table.getRowModel().rows;
  const counts = (id: string) =>
    table.getColumn(id)?.getFacetedUniqueValues() ?? new Map<unknown, number>();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search keywords"
          value={filters.q}
          onSearch={(q, options) => void setFilters({ q }, options)}
        />
        <FacetFilter
          title="Source"
          options={SOURCE_OPTIONS}
          selected={filters.source}
          counts={counts("source")}
          onChange={(source) => void setFilters({ source })}
        />
        <FacetFilter
          title="Bucket"
          options={BUCKET_OPTIONS}
          selected={filters.bucket}
          counts={counts("bucket")}
          onChange={(bucket) => void setFilters({ bucket })}
        />
        <SelectFilter
          title="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => void setFilters({ status })}
        />
        <RowCount
          shown={shown.length}
          total={table.getPreFilteredRowModel().rows.length}
          noun="keyword"
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={shown.length === 0}
          onClick={() =>
            exportKeywords(
              appId,
              shown.map((row) => row.original),
            )
          }
          aria-label="Export keywords to CSV"
        >
          <Download />
          Export CSV
        </Button>
      </div>
      <FilterChips
        chips={keywordFilterChips(filters).map((chip) => ({
          ...chip,
          onRemove: () => void setFilters({ [chip.key]: null }),
        }))}
        onClearAll={() => void setFilters(null)}
      />
    </div>
  );
}
