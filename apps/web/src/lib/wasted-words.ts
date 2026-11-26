import { createTranslator } from "next-intl";
import type { SplitPhrase, WastedWord } from "@asobeast/shared";
import enKeywords from "../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatListInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { localizationNameInLocale } from "@/lib/localizations";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const WASTE_LINE_LIMIT = 5;

const namesOf = (localizations: readonly string[], locale: Locale): string =>
  formatListInLocale(
    localizations.map((localization) =>
      localizationNameInLocale(localization, locale),
    ),
    locale,
  );

export function wastedWordLine(
  { word, localizations }: WastedWord,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return t("wasted.wordLine", {
    word,
    localizations: namesOf(localizations, locale),
  });
}

export function splitPhraseLine(
  { phrase, parts }: SplitPhrase,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const holders = parts
    .map(({ word, localizations }) =>
      t("wasted.partLine", {
        word,
        localizations: namesOf(localizations, locale),
      }),
    )
    .join(locale === "en" ? ", " : "、");
  return t("wasted.phraseLine", { phrase, holders });
}

export function limitedLines(
  lines: readonly string[],
  limit = WASTE_LINE_LIMIT,
): { shown: string[]; hidden: number } {
  return {
    shown: lines.slice(0, limit),
    hidden: Math.max(lines.length - limit, 0),
  };
}

export const moreLine = (
  hidden: number,
  t: MessageTranslator = english,
): string => t("wasted.more", { count: hidden });
