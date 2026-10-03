"use client";

import {
  useTable,
  type RowData,
  type TableOptions,
} from "@tanstack/react-table";
import {
  dataTableFeatures,
  type DataTableFeatures,
} from "@/components/data-table/table-features";
import { useStoredColumnVisibility } from "@/components/data-table/useStoredColumnVisibility";
import {
  useUrlSorting,
  type UrlSort,
} from "@/components/data-table/useUrlSorting";

export const PLAN_COLUMN = "plan";

export function useAdminTable<TData extends RowData>({
  name,
  data,
  columns,
  getRowId,
  sort,
  onSort,
  billing,
}: {
  name: string;
  data: TData[];
  columns: TableOptions<DataTableFeatures, TData>["columns"];
  getRowId: (row: TData) => string;
  sort: UrlSort;
  onSort: (next: UrlSort) => void;
  billing: boolean;
}) {
  const [visibility, setVisibility] = useStoredColumnVisibility(name, columns);
  const { sorting, onSortingChange } = useUrlSorting(sort, columns, onSort);

  return useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    state: {
      sorting,
      columnVisibility: billing
        ? visibility
        : { ...visibility, [PLAN_COLUMN]: false },
    },
    onSortingChange,
    onColumnVisibilityChange: setVisibility,
    enableSortingRemoval: false,
    enableMultiSort: false,
  });
}
