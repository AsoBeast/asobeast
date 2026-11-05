import {
  KEYWORD_CLASSES,
  type KeywordClass,
  type KeywordUpdateRequest,
  type TrackedKeywordItem,
} from "@asobeast/shared";

export const KEYWORD_CLASS_LABELS: Record<KeywordClass, string> = {
  ownBrand: "Own brand",
  competitorBrand: "Competitor brand",
  generic: "Generic",
};

export const KEYWORD_CLASS_OPTIONS = KEYWORD_CLASSES.map((value) => ({
  value,
  label: KEYWORD_CLASS_LABELS[value],
}));

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
