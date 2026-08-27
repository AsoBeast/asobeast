import {
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Table features the keywords table opts into. Version 9 ships nothing beyond
 * the core row model unless it is named here, so this is the single place that
 * decides what the table can do: row selection drives the bulk action bar, and
 * column visibility backs the visible cell and column lookups the data table
 * renders from. Sorting stays off the list because the API sorts, not the table.
 */
export const keywordTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});

export type KeywordTableFeatures = typeof keywordTableFeatures;
