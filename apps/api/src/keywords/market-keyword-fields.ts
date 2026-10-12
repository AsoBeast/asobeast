import {
  AppLocalizationOrigin,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  keywordFieldLocalizations,
  MarketLocalizationRead,
} from '@asobeast/shared';
import { homeLocalization } from './localization-markets';

export type FieldPhrases = ReadonlyMap<string, readonly string[]>;

export interface MarketReadsInput {
  country: string;
  home: string;
  shipped: ReadonlyMap<string, AppLocalizationOrigin>;
  fields: FieldPhrases;
}

export function marketReads({
  country,
  home,
  shipped,
  fields,
}: MarketReadsInput): MarketLocalizationRead[] {
  const homeTag = homeLocalization(home);
  return keywordFieldLocalizations(country).map(
    (localization, index): MarketLocalizationRead => {
      const origin: AppLocalizationOrigin | null =
        shipped.get(localization) ?? (localization === homeTag ? 'home' : null);
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
