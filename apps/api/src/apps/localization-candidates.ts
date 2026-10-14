import {
  type AppStoreLocalization,
  keywordFieldLocalizations,
  localizationLanguage,
} from '@asobeast/shared';

export interface DetectionCandidate {
  localization: AppStoreLocalization;
  country: string;
}

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = { nb: 'no' };

const declaredLanguage = (code: string): string => {
  const language = code.toLowerCase();
  return LANGUAGE_ALIASES[language] ?? language;
};

const probeOrder = (
  home: string,
  markets: readonly string[],
  listedMarkets: ReadonlySet<string>,
): string[] =>
  [
    home,
    ...[...new Set(markets)].filter((market) => market !== home).sort(),
  ].filter((market) => listedMarkets.has(market));

export function detectionCandidates({
  home,
  markets,
  listedMarkets,
  shipped,
  languages,
}: {
  home: string;
  markets: readonly string[];
  listedMarkets: ReadonlySet<string>;
  shipped: ReadonlySet<string>;
  languages: readonly string[] | null;
}): DetectionCandidate[] {
  const declared = languages && new Set(languages.map(declaredLanguage));
  const found = new Map<AppStoreLocalization, string>();
  for (const country of probeOrder(home, markets, listedMarkets)) {
    for (const localization of keywordFieldLocalizations(country).slice(1)) {
      const declaredByApp =
        declared === null || declared.has(localizationLanguage(localization));
      if (
        declaredByApp &&
        !shipped.has(localization) &&
        !found.has(localization)
      ) {
        found.set(localization, country);
      }
    }
  }
  return [...found].map(([localization, country]) => ({
    localization,
    country,
  }));
}
