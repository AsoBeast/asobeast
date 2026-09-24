import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { TableColumnMeta } from "@/lib/table/column-visibility";

export const keywordTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<TableColumnMeta>(),
});

export type KeywordTableFeatures = typeof keywordTableFeatures;
