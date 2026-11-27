import {
  AppLocalizationOrigin,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  keywordFieldLocalizations,
  MarketLocalizationRead,
} from '@asobeast/shared';
import type { FieldPhrases } from '../metadata/listing-surfaces';
import { homeLocalizationOf } from './localization-markets';

export interface MarketReadsInput {
  country: string;
  home: string;
  defaultLocalization: string | null;
  shipped: ReadonlyMap<string, AppLocalizationOrigin>;
  fields: FieldPhrases;
}

export function marketReads({
  country,
  home,
  defaultLocalization,
  shipped,
  fields,
}: MarketReadsInput): MarketLocalizationRead[] {
  const homeTag = homeLocalizationOf({ country: home, defaultLocalization });
  return keywordFieldLocalizations(country).map(
    (localization, index): MarketLocalizationRead => {
      const origin: AppLocalizationOrigin | null =
        localization === homeTag ? 'home' : (shipped.get(localization) ?? null);
      const phrases = [...(fields.get(localization) ?? [])];
      return {
        localization,
        role: index === 0 ? 'default' : 'additional',
        shipped: origin !== null,
        origin,
        phrases,
        charactersUsed: keywordFieldChars(phrases),
        charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      };
    },
  );
}
