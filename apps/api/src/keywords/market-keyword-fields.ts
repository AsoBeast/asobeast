import {
  AppLocalizationOrigin,
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  MarketLocalizationRead,
} from '@asobeast/shared';
import type { FieldPhrases } from '../metadata/listing-surfaces';
import { homeLocalizationOf, storefrontReads } from './localization-markets';

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
  const owner = { country: home, defaultLocalization };
  const homeTag = homeLocalizationOf(owner);
  return storefrontReads(owner, country).map(
    ({ localization, role }): MarketLocalizationRead => {
      const origin: AppLocalizationOrigin | null =
        localization === homeTag ? 'home' : (shipped.get(localization) ?? null);
      const phrases = [...(fields.get(localization) ?? [])];
      return {
        localization,
        role,
        shipped: origin !== null,
        origin,
        phrases,
        charactersUsed: keywordFieldChars(phrases),
        charactersLimit: KEYWORD_FIELD_CHAR_LIMIT,
      };
    },
  );
}
