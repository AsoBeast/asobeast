"use client";

import type { ReactNode } from "react";
import type { RowData, Table as TableInstance } from "@tanstack/react-table";
import type { Options } from "nuqs";
import { ColumnMenu } from "@/components/data-table/ColumnMenu";
import {
  FilterChips,
  type FilterChip,
} from "@/components/data-table/FilterChips";
import { FilteredEmpty } from "@/components/data-table/FilteredEmpty";
import { SearchInput } from "@/components/data-table/SearchInput";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { PANEL_BLEED } from "@/components/layout/panel-classes";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { adminSearchLabel } from "./admin-search";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import { AdminTable } from "./AdminTable";
import { ListLimitNote } from "./ListLimitNote";
import { PLAN_COLUMN } from "./useAdminTable";

export function AdminList<TData extends RowData>({
  table,
  caption,
  noun,
  loaded,
  total,
  billing,
  search,
  onSearch,
  chips = [],
  onClearFilters,
  filters,
  reads,
  billingColumns = [PLAN_COLUMN],
}: {
  table: TableInstance<DataTableFeatures, TData>;
  caption: string;
  noun: string;
  loaded: number;
  total: number;
  billing: boolean;
  search: string;
  onSearch: (value: string, options: Options) => void;
  chips?: readonly FilterChip[];
  onClearFilters: () => void;
  filters?: ReactNode;
  reads: string;
  billingColumns?: readonly string[];
}) {
  const shown = table.getRowModel().rows.length;
  const filtered = search !== "" || chips.length > 0;
  const hideable = table
    .getAllLeafColumns()
    .filter((column) => billing || !billingColumns.includes(column.id));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label={adminSearchLabel(noun)}
          value={search}
          onSearch={onSearch}
        />
        {filters}
        <div className="ml-auto flex items-center gap-3">
          <ColumnMenu columns={hideable} />
        </div>
      </div>
      <FilterChips chips={chips} onClearAll={onClearFilters} />
      <ListLimitNote shown={loaded} total={total} noun={noun} />
      <Card className="min-w-0">
        <CardContent className={PANEL_BLEED}>
          {shown > 0 ? (
            <AdminTable table={table} caption={caption} />
          ) : filtered ? (
            <FilteredEmpty
              title={`No ${noun}s match these filters`}
              onClear={onClearFilters}
            />
          ) : (
            <EmptyState title={`No ${noun}s on this instance yet`} />
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-between">
          <span aria-live="polite">
            {`${formatNumber(shown)} of ${formatNumber(loaded)} ${loaded === 1 ? noun : `${noun}s`}`}
          </span>
          <span>{reads}</span>
        </CardFooter>
      </Card>
    </div>
  );
}
