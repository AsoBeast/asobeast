import type { CoverageFieldStatus, MetadataField } from '@asobeast/shared';
import { keywordWords, wordMatch } from '../keywords/keyword-breakdown-fields';
import { coversKeyword } from '../keywords/keyword-coverage';

export interface Surface {
  field: MetadataField;
  value: string;
}

export interface LocalizedSurfaces {
  localization: string;
  surfaces: readonly Surface[];
}

export function judgeFields(
  text: string,
  surfaces: readonly Surface[],
  localized: readonly LocalizedSurfaces[],
): CoverageFieldStatus[] {
  return surfaces.map(({ field, value }) => {
    if (coversKeyword(value, text)) return { field, covered: true };
    const found = localized.find((listing) =>
      listing.surfaces.some(
        (surface) =>
          surface.field === field && coversKeyword(surface.value, text),
      ),
    );
    return found
      ? { field, covered: true, localization: found.localization }
      : { field, covered: false };
  });
}

const holdsEveryWord = (
  surfaces: readonly Surface[],
  words: readonly string[],
): boolean =>
  words.every((word) =>
    surfaces.some(({ value }) => wordMatch(value, word) === 'exact'),
  );

export function wordsSplit(
  text: string,
  surfaces: readonly Surface[],
  localized: readonly LocalizedSurfaces[],
): boolean {
  const words = keywordWords(text);
  return (
    words.length > 0 &&
    [surfaces, ...localized.map((listing) => listing.surfaces)].some((group) =>
      holdsEveryWord(group, words),
    )
  );
}
