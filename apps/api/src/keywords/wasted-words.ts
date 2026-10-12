import {
  type AppStoreLocalization,
  isAppStoreLocalization,
  isStopword,
  type MarketLocalizationRead,
  type SplitPhrase,
  tokenize,
  type WastedWord,
} from '@asobeast/shared';
import { isUnsegmented } from '../common/text/scripts';
import type { JudgingSurfaces } from '../metadata/listing-surfaces';
import type { Surface } from '../metadata/localized-coverage';
import { coversKeyword } from './keyword-coverage';

export interface LocalizationText {
  localization: AppStoreLocalization;
  text: string;
}

export interface TrackedPhrase {
  keywordId: string;
  text: string;
}

const alphabetical = (left: string, right: string): number =>
  left.localeCompare(right, 'en');

const significantWords = (text: string): string[] =>
  tokenize(text).filter((word) => !isStopword(word));

const textOf = (surfaces: readonly Surface[]): string =>
  surfaces.map(({ value }) => value).join(' ');

export function wastedWords(
  reads: readonly MarketLocalizationRead[],
): WastedWord[] {
  const holders = new Map<string, AppStoreLocalization[]>();
  for (const read of reads.filter(({ shipped }) => shipped)) {
    for (const word of new Set(significantWords(read.phrases.join(' ')))) {
      holders.set(word, [...(holders.get(word) ?? []), read.localization]);
    }
  }
  return [...holders]
    .filter(([, localizations]) => localizations.length > 1)
    .map(([word, localizations]) => ({ word, localizations }))
    .sort((left, right) => alphabetical(left.word, right.word));
}

export function localizationGroups(
  read: readonly AppStoreLocalization[],
  { surfaces, localized }: JudgingSurfaces,
): LocalizationText[] {
  return [
    { localization: read[0], text: textOf(surfaces) },
    ...localized.flatMap(({ localization, surfaces: own }) =>
      isAppStoreLocalization(localization)
        ? [{ localization, text: textOf(own) }]
        : [],
    ),
  ];
}

export function splitPhrases({
  phrases,
  groups,
}: {
  phrases: readonly TrackedPhrase[];
  groups: readonly LocalizationText[];
}): SplitPhrase[] {
  const holdersOf = (word: string): AppStoreLocalization[] =>
    groups
      .filter(({ text }) => coversKeyword(text, word))
      .map(({ localization }) => localization);

  return phrases
    .flatMap(({ keywordId, text }) => {
      const words = [...new Set(significantWords(text))];
      if (words.length < 2 || isUnsegmented(text)) return [];
      const parts = words.map((word) => ({
        word,
        localizations: holdersOf(word),
      }));
      const everyWordFound = parts.every(
        ({ localizations }) => localizations.length > 0,
      );
      const heldWhole = groups.some(({ localization }) =>
        parts.every((part) => part.localizations.includes(localization)),
      );
      return everyWordFound && !heldWhole
        ? [{ keywordId, phrase: text, parts }]
        : [];
    })
    .sort((left, right) => alphabetical(left.phrase, right.phrase));
}
