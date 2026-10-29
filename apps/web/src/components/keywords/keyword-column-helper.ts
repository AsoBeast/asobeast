import { createColumnHelper } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import type { KeywordTableFeatures } from "./keyword-table-features";

export const keywordColumnHelper = createColumnHelper<
  KeywordTableFeatures,
  TrackedKeywordItem
>();

export const SORTABLE = { sortUndefined: "last", sortFn: "basic" } as const;
