import type { KeywordComparisonRow } from "@asobeast/shared";

export const isChecked = (
  row: Pick<KeywordComparisonRow, "unchecked">,
  appId: string,
): boolean => row.unchecked?.includes(appId) !== true;
