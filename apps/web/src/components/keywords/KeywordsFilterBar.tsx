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
import { KeywordFiltersPopover, KeywordFiltersSheet } from "./KeywordFilters";
import { KeywordMoveSwitch } from "./KeywordMoveSwitch";

const CHIPS_OUTSIDE_THE_PANEL: ReadonlySet<string> = new Set([
  "q",
  "zone",
  "change",
]);

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
  const everyKeyword = table
    .getPreFilteredRowModel()
    .rows.map((row) => row.original);
  const chips = keywordFilterChips(filters);
  const active = chips.filter(
    (chip) => !CHIPS_OUTSIDE_THE_PANEL.has(chip.key),
  ).length;
  const widerFilters = useRef<HTMLDivElement>(null);
  const narrowerFilters = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search keywords"
          value={filters.q}
          onSearch={(q, options) => void setFilters({ q }, options)}
        />
        <div ref={narrowerFilters} className="contents md:hidden">
          <KeywordFiltersSheet
            table={table}
            filters={filters}
            setFilters={setFilters}
            active={active}
            otherWidth={widerFilters}
          />
        </div>
        <div ref={widerFilters} className="hidden md:contents">
          <KeywordFiltersPopover
            table={table}
            filters={filters}
            setFilters={setFilters}
            active={active}
            otherWidth={narrowerFilters}
          />
        </div>
        <KeywordMoveSwitch
          keywords={everyKeyword}
          today={today}
          value={filters.change}
          onChange={(change) => void setFilters({ change })}
        />
        <RowCount
          shown={shown.length}
          total={everyKeyword.length}
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
