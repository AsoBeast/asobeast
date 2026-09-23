import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { TableColumnMeta } from "@/lib/table/column-visibility";

export const comparisonTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<TableColumnMeta>(),
});

export type ComparisonTableFeatures = typeof comparisonTableFeatures;
