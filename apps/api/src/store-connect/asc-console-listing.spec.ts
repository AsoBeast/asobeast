import { descriptionFingerprint } from '../apps/description-fingerprint';
import {
  descriptionFingerprintsOf,
  primaryLocalizationOf,
} from './asc-console-listing';

const served = (locale: string, description: string | null) => ({
  locale,
  keywords: '',
  promotionalText: null,
  description,
});

describe('descriptionFingerprintsOf', () => {
  it('fingerprints each mapped localization by its app store tag', () => {
    expect(
      descriptionFingerprintsOf([
        served('en-US', 'Plan the family week.'),
        served('de-DE', 'Plane die Woche.'),
      ]),
    ).toEqual({
      'en-US': descriptionFingerprint('Plan the family week.'),
      de: descriptionFingerprint('Plane die Woche.'),
    });
  });

  it('leaves out an unmapped locale and an empty or missing description', () => {
    expect(
      descriptionFingerprintsOf([
        served('xx-XX', 'Unknown locale.'),
        served('en-GB', '   '),
        served('fr-FR', null),
      ]),
    ).toEqual({});
  });
});

describe('primaryLocalizationOf', () => {
  it('maps the console locale to its app store tag', () => {
    expect(primaryLocalizationOf('de-DE')).toBe('de');
    expect(primaryLocalizationOf('en-US')).toBe('en-US');
  });

  it('answers null for no locale or an unmapped one', () => {
    expect(primaryLocalizationOf(null)).toBeNull();
    expect(primaryLocalizationOf('xx-XX')).toBeNull();
  });
});
