import type {
  KeywordUpdateRequest,
  TrackedKeywordItem,
} from "@asobeast/shared";

export function optimisticKeyword(
  row: TrackedKeywordItem,
  update: KeywordUpdateRequest,
): TrackedKeywordItem {
  const { keywordClass, ...fields } = update;
  return {
    ...row,
    ...fields,
    ...(keywordClass ? { keywordClass, keywordClassSource: "owner" } : {}),
  };
}
