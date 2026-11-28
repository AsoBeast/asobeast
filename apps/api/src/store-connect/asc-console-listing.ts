import { descriptionFingerprint } from '../apps/description-fingerprint';
import { localizationOfAscLocale } from './asc-locales';
import type { AscAppVersionLocalization } from './asc-listing-api';

export interface ConsoleListingRecord {
  primaryLocale: string | null;
  descriptionFingerprints: Record<string, string>;
}

export const descriptionFingerprintsOf = (
  served: readonly AscAppVersionLocalization[],
): Record<string, string> =>
  Object.fromEntries(
    served.flatMap(({ locale, description }) => {
      const localization = localizationOfAscLocale(locale);
      return localization !== null && description?.trim()
        ? [[localization, descriptionFingerprint(description)]]
        : [];
    }),
  );

export const primaryLocalizationOf = (locale: string | null): string | null =>
  locale === null ? null : localizationOfAscLocale(locale);
