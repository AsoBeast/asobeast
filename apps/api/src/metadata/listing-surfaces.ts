import { Store } from '@prisma/client';
import { readLocalizations } from '@asobeast/shared';
import { ListingTexts, LocalizedTexts } from '../apps/listing-texts';
import { StoredKeywordField } from '../keywords/keyword-field-index';
import { LocalizedSurfaces, Surface } from './localized-coverage';

export type FieldPhrases = ReadonlyMap<string, readonly string[]>;

export interface JudgingSurfaces {
  surfaces: Surface[];
  localized: LocalizedSurfaces[];
}

export const fieldPhrases = (
  fields: readonly StoredKeywordField[],
): FieldPhrases =>
  new Map(fields.map((field) => [field.localization, field.phrases]));

export const keywordFieldOf = (
  fields: FieldPhrases,
  localization: string | undefined,
): string =>
  localization === undefined ? '' : (fields.get(localization) ?? []).join(',');

export function listingSurfaces(
  store: Store,
  listing: ListingTexts | undefined,
  keywordField: string | null,
): Surface[] {
  const title = { field: 'title' as const, value: listing?.title ?? '' };
  if (store === Store.GOOGLE_PLAY) {
    return [
      title,
      { field: 'shortDescription', value: listing?.summary ?? '' },
      { field: 'description', value: listing?.description ?? '' },
    ];
  }
  const subtitle = {
    field: 'subtitle' as const,
    value: listing?.subtitle ?? '',
  };
  return keywordField === null
    ? [title, subtitle]
    : [title, subtitle, { field: 'keywordField', value: keywordField }];
}

export interface JudgingMarket {
  store: Store;
  country: string;
  home: boolean;
  listing: ListingTexts | undefined;
  captured: readonly LocalizedTexts[];
}

export function judgingSurfaces(
  { store, country, home, listing, captured }: JudgingMarket,
  fields: FieldPhrases,
): JudgingSurfaces {
  if (store === Store.GOOGLE_PLAY) {
    return { surfaces: listingSurfaces(store, listing, null), localized: [] };
  }
  const read = readLocalizations(country);
  const [primary, ...others] = read;
  const judgesField = home || read.some((tag) => fields.has(tag));
  const texts = new Map(
    captured.map((entry) => [entry.localization, entry.texts]),
  );
  return {
    surfaces: listingSurfaces(
      store,
      listing,
      judgesField ? keywordFieldOf(fields, primary) : null,
    ),
    localized: others
      .filter((tag) => texts.has(tag) || fields.has(tag))
      .map((tag) => ({
        localization: tag,
        surfaces: [
          ...(texts.has(tag)
            ? listingSurfaces(store, texts.get(tag), null)
            : []),
          ...(fields.has(tag)
            ? [
                {
                  field: 'keywordField' as const,
                  value: keywordFieldOf(fields, tag),
                },
              ]
            : []),
        ],
      })),
  };
}
