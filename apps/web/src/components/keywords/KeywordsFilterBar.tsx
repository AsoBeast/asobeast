"use client";

import { Download } from "lucide-react";
import type { SetValues } from "nuqs";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { Button } from "@/components/ui/button";
import type { keywordFilterParsers } from "@/lib/search-params";
import type { KeywordTableFeatures } from "./keyword-table-features";
import { exportKeywords } from "./keyword-csv";
import { keywordFilterChips, type KeywordFilters } from "./keyword-filters";
import { KeywordFacets } from "./KeywordFacets";

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search keywords"
          value={filters.q}
          onSearch={(q, options) => void setFilters({ q }, options)}
        />
        <KeywordFacets
          table={table}
          filters={filters}
          setFilters={setFilters}
        />
        <RowCount
          shown={shown.length}
          total={table.getPreFilteredRowModel().rows.length}
          noun="keyword"
        />
        <div className="ml-auto flex items-center gap-2">
          <ColumnMenu columns={table.getAllLeafColumns()} />
          <Button
            variant="outline"
            size="sm"
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
