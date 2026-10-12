import { Store } from '@prisma/client';
import { fieldPhrases, judgingSurfaces } from './listing-surfaces';

const listing = {
  id: 's',
  title: 'Habit Tracker',
  subtitle: 'Daily Streak',
  summary: null,
  description: '',
};

describe('judgingSurfaces', () => {
  it('judges the home market against the field of its default localization', () => {
    const { surfaces, localized } = judgingSurfaces(
      {
        store: Store.APP_STORE,
        country: 'us',
        home: true,
        listing,
        captured: [],
      },
      fieldPhrases([{ localization: 'en-US', phrases: ['habit', 'goals'] }]),
    );

    expect(surfaces.at(-1)).toEqual({
      field: 'keywordField',
      value: 'habit,goals',
    });
    expect(localized).toEqual([]);
  });

  it('keeps the home keyword field cell when nothing is saved', () => {
    const { surfaces } = judgingSurfaces(
      {
        store: Store.APP_STORE,
        country: 'us',
        home: true,
        listing,
        captured: [],
      },
      fieldPhrases([]),
    );

    expect(surfaces.at(-1)).toEqual({ field: 'keywordField', value: '' });
  });

  it('adds a localized field the storefront reads even without a captured listing', () => {
    const { localized } = judgingSurfaces(
      {
        store: Store.APP_STORE,
        country: 'us',
        home: true,
        listing,
        captured: [],
      },
      fieldPhrases([{ localization: 'es-MX', phrases: ['habito'] }]),
    );

    expect(localized).toEqual([
      {
        localization: 'es-MX',
        surfaces: [{ field: 'keywordField', value: 'habito' }],
      },
    ]);
  });

  it('merges a captured localized listing with its field', () => {
    const { localized } = judgingSurfaces(
      {
        store: Store.APP_STORE,
        country: 'pl',
        home: false,
        listing,
        captured: [
          { localization: 'pl', texts: { ...listing, title: 'Nawyki' } },
        ],
      },
      fieldPhrases([{ localization: 'pl', phrases: ['nawyk'] }]),
    );

    expect(localized[0]?.surfaces.map((surface) => surface.field)).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
  });

  it('gives a market that reads no saved field no keyword field cell', () => {
    const { surfaces } = judgingSurfaces(
      {
        store: Store.APP_STORE,
        country: 'de',
        home: false,
        listing,
        captured: [],
      },
      fieldPhrases([{ localization: 'en-US', phrases: ['habit'] }]),
    );

    expect(surfaces.map((surface) => surface.field)).toEqual([
      'title',
      'subtitle',
    ]);
  });

  it('judges a market against the field of its default localization', () => {
    const { surfaces } = judgingSurfaces(
      {
        store: Store.APP_STORE,
        country: 'at',
        home: false,
        listing,
        captured: [],
      },
      fieldPhrases([{ localization: 'de', phrases: ['gewohnheit'] }]),
    );

    expect(surfaces.at(-1)).toEqual({
      field: 'keywordField',
      value: 'gewohnheit',
    });
  });

  it('judges a google play listing on its own fields only', () => {
    const { surfaces, localized } = judgingSurfaces(
      {
        store: Store.GOOGLE_PLAY,
        country: 'us',
        home: true,
        listing,
        captured: [],
      },
      fieldPhrases([{ localization: 'en-US', phrases: ['habit'] }]),
    );

    expect(surfaces.map((surface) => surface.field)).toEqual([
      'title',
      'shortDescription',
      'description',
    ]);
    expect(localized).toEqual([]);
  });
});
