"use client";

import type { ComponentProps } from "react";
import { Download } from "lucide-react";
import type { inferParserType, SetValues } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { Button } from "@/components/ui/button";
import { VERSUS_FILTERS, type matrixFilterParsers } from "@/lib/search-params";

type MatrixFilters = inferParserType<typeof matrixFilterParsers>;

const RESULT_LABELS: Record<MatrixFilters["vs"], string> = {
  all: "All results",
  winning: "Winning",
  losing: "Losing",
  tied: "Tied",
};

const RESULT_OPTIONS = VERSUS_FILTERS.map((value) => ({
  value,
  label: RESULT_LABELS[value],
}));

export function ComparisonFilterBar({
  filters,
  setFilters,
  shown,
  total,
  columns,
  onExport,
}: {
  filters: MatrixFilters;
  setFilters: SetValues<typeof matrixFilterParsers>;
  shown: number;
  total: number;
  columns: ComponentProps<typeof ColumnMenu>["columns"];
  onExport: () => void;
}) {
  const chips = [
    filters.q
      ? {
          key: "q",
          label: `Search: ${filters.q}`,
          onRemove: () => void setFilters({ q: null }),
        }
      : null,
    filters.vs !== "all"
      ? {
          key: "vs",
          label: `Result: ${RESULT_LABELS[filters.vs]}`,
          onRemove: () => void setFilters({ vs: null }),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search keywords"
          value={filters.q}
          onSearch={(q, options) => void setFilters({ q }, options)}
        />
        <SelectFilter
          title="Result"
          value={filters.vs}
          options={RESULT_OPTIONS}
          onChange={(vs) => void setFilters({ vs })}
        />
        <RowCount shown={shown} total={total} noun="keyword" />
        <div className="ml-auto flex items-center gap-2">
          <ColumnMenu columns={columns} />
          <Button
            variant="outline"
            size="sm"
            disabled={shown === 0}
            onClick={onExport}
            aria-label="Export comparison to CSV"
          >
            <Download />
            Export CSV
          </Button>
        </div>
      </div>
      <FilterChips chips={chips} onClearAll={() => void setFilters(null)} />
    </div>
  );
}
