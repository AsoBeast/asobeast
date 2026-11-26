import type {
  CompetitorGapCoverage,
  KeywordComparisonRow,
} from "@asobeast/shared";
import { formatCountryInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { MessageTranslator } from "@/i18n/translator";
import enCompetitors from "../../../messages/en/competitors.json";
import { createTranslator } from "next-intl";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

export const ALL_MARKETS = "all";

const byName = (a: string, b: string, locale: Locale) =>
  formatCountryInLocale(a, locale).localeCompare(
    formatCountryInLocale(b, locale),
    locale,
  );

export function comparisonMarkets(
  rows: readonly Pick<KeywordComparisonRow, "country">[],
  home: string,
  selected = "",
  locale: Locale = "en",
): string[] {
  const markets = [
    ...new Set([...rows.map((row) => row.country), selected].filter(Boolean)),
  ];
  return [
    ...markets.filter((market) => market === home),
    ...markets
      .filter((market) => market !== home)
      .sort((a, b) => byName(a, b, locale)),
  ];
}

export const marketOptions = (
  markets: readonly string[],
  t: MessageTranslator = english,
  locale: Locale = "en",
) => [
  { value: ALL_MARKETS, label: t("comparison.allMarkets") },
  ...markets.map((market) => ({
    value: market,
    label: formatCountryInLocale(market, locale),
  })),
];

export const gapMarkets = (
  coverage: CompetitorGapCoverage | undefined,
  home: string,
  locale: Locale = "en",
): string[] => comparisonMarkets(coverage?.markets ?? [], home, "", locale);
