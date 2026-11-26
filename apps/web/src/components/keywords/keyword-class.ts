import {
  KEYWORD_CLASSES,
  type KeywordClass,
  type KeywordUpdateRequest,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const KEYWORD_CLASS_LABELS: Record<KeywordClass, string> = {
  ownBrand: enKeywords.types.ownBrand,
  competitorBrand: enKeywords.types.competitorBrand,
  generic: enKeywords.types.generic,
};

export const DETECTED_CHOICE = "detected";

export type KeywordClassChoice = KeywordClass | typeof DETECTED_CHOICE;

export function keywordClassLabel(
  value: KeywordClass,
  t: MessageTranslator = english,
): string {
  return t(`types.${value}`);
}

export function keywordClassOptions(t: MessageTranslator = english) {
  return KEYWORD_CLASSES.map((value) => ({
    value,
    label: keywordClassLabel(value, t),
  }));
}

export const KEYWORD_CLASS_OPTIONS = keywordClassOptions();

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
