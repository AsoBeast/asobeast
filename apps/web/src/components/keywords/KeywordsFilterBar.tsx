"use client";

import { useRef } from "react";
import type { SetValues } from "nuqs";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  ColumnMenu,
  type ViewOption,
} from "@/components/data-table/ColumnMenu";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { keywordFilterParsers } from "@/lib/search-params";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import { keywordFilterChips, type KeywordFilters } from "./keyword-filters";
import { KeywordFacets } from "./KeywordFacets";
import { KeywordFiltersSheet } from "./KeywordFiltersSheet";

export function KeywordsFilterBar({
  appId,
  table,
  filters,
  setFilters,
  today,
  viewOptions,
}: {
  appId: string;
  table: Table<KeywordTableFeatures, TrackedKeywordItem>;
  filters: KeywordFilters;
  setFilters: SetValues<typeof keywordFilterParsers>;
  today: string;
  viewOptions: readonly ViewOption[];
}) {
  const shown = table.getRowModel().rows;
  const chips = keywordFilterChips(filters);
  const inlineFacets = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search keywords"
          value={filters.q}
          onSearch={(q, options) => void setFilters({ q }, options)}
        />
        <div className="contents md:hidden">
          <KeywordFiltersSheet
            table={table}
            filters={filters}
            setFilters={setFilters}
            active={chips.filter((chip) => chip.key !== "q").length}
            inlineFacets={inlineFacets}
          />
        </div>
        <div ref={inlineFacets} className="hidden md:contents">
          <KeywordFacets
            table={table}
            filters={filters}
            setFilters={setFilters}
          />
        </div>
        <RowCount
          shown={shown.length}
          total={table.getPreFilteredRowModel().rows.length}
          noun="keyword"
        />
        <div className="ml-auto flex items-center gap-2">
          <ColumnMenu
            columns={table.getAllLeafColumns()}
            options={viewOptions}
          />
          <ExportCsvButton
            subject="keywords"
            disabled={shown.length === 0}
            onClick={() =>
              exportKeywords(
                appId,
                shown.map((row) => row.original),
                today,
              )
            }
          />
        </div>
      </div>
      <FilterChips
        chips={chips.map((chip) => ({
          ...chip,
          onRemove: () => void setFilters({ [chip.key]: null }),
        }))}
        onClearAll={() => void setFilters(null)}
      />
    </div>
  );
}
