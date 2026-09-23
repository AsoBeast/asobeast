import {
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
} from "@tanstack/react-table";
import type { TableColumnMeta } from "@/lib/table/column-visibility";

export const comparisonTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
  columnMeta: metaHelper<TableColumnMeta>(),
});

export type ComparisonTableFeatures = typeof comparisonTableFeatures;
