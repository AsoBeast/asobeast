import type { CoverageFieldStatus, MetadataField } from '@asobeast/shared';
import { coversKeyword } from '../keywords/keyword-coverage';

export interface Surface {
  field: MetadataField;
  value: string;
}

export interface LocalizedSurfaces {
  localization: string;
  surfaces: readonly Surface[];
}

const LOCALIZED_FIELD_EXCLUDED: ReadonlySet<MetadataField> = new Set([
  'keywordField',
]);

export function judgeFields(
  text: string,
  surfaces: readonly Surface[],
  localized: readonly LocalizedSurfaces[],
): CoverageFieldStatus[] {
  return surfaces.map(({ field, value }) => {
    if (coversKeyword(value, text)) return { field, covered: true };
    if (LOCALIZED_FIELD_EXCLUDED.has(field)) return { field, covered: false };
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
