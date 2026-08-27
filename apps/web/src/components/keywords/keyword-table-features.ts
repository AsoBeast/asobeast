import {
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";

export const keywordTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});

export type KeywordTableFeatures = typeof keywordTableFeatures;
