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

export const DETECTED_CHOICE = "detected";

export type KeywordClassChoice = KeywordClass | typeof DETECTED_CHOICE;

export function classChoice(
  row: Pick<TrackedKeywordItem, "keywordClass" | "keywordClassSource">,
): KeywordClassChoice {
  return row.keywordClassSource === "owner" && row.keywordClass
    ? row.keywordClass
    : DETECTED_CHOICE;
}

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

export function answeredKeyword(
  row: TrackedKeywordItem,
  answer: TrackedKeywordItem,
): TrackedKeywordItem {
  return answer.keywordClass === undefined
    ? row
    : {
        ...row,
        keywordClass: answer.keywordClass,
        keywordClassSource: answer.keywordClassSource,
      };
}
