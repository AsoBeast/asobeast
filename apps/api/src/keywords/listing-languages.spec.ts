import { Store } from '@prisma/client';
import { defaultListingLanguages, listingLanguages } from './listing-languages';

describe('listingLanguages', () => {
  it.each([
    ['ca', ['fr']],
    ['ch', ['de', 'fr', 'it']],
    ['us', []],
  ])(
    'reads every language of the app store storefront %s',
    (country, languages) => {
      expect(listingLanguages(Store.APP_STORE, country)).toEqual(languages);
    },
  );

  it.each([
    ['ar', ['es']],
    ['ch', ['de']],
    ['ca', []],
    ['be', []],
    ['us', []],
    ['zz', []],
  ])(
    'reads only the language google play is asked for in %s',
    (country, languages) => {
      expect(listingLanguages(Store.GOOGLE_PLAY, country)).toEqual(languages);
    },
  );
});

describe('defaultListingLanguages', () => {
  const app = (
    country: string,
    defaultLocalization: string | null,
    store: Store = Store.APP_STORE,
  ) => ({ store, country, defaultLocalization });

  it.each([
    ['an english default in germany as english', app('de', 'en-GB'), ['en']],
    ['a polish default in poland as polish', app('pl', 'pl'), ['pl']],
    ['an english default in japan as english', app('jp', 'en-US'), ['en']],
    [
      'a spanish (mexico) default in the united states as spanish',
      app('us', 'es-MX'),
      ['es'],
    ],
  ])('reads %s', (_case, listed, languages) => {
    expect(defaultListingLanguages(listed)).toEqual(languages);
  });

  it('reads a storefront default with the market languages', () => {
    expect(defaultListingLanguages(app('de', null))).toEqual(
      listingLanguages(Store.APP_STORE, 'de'),
    );
  });

  it('reads another market with its own languages', () => {
    expect(defaultListingLanguages(app('de', 'en-GB'), 'at')).toEqual(
      listingLanguages(Store.APP_STORE, 'at'),
    );
  });

  it('reads a google play listing with the market languages', () => {
    expect(defaultListingLanguages(app('de', null, Store.GOOGLE_PLAY))).toEqual(
      listingLanguages(Store.GOOGLE_PLAY, 'de'),
    );
  });
});
