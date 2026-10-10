import { Store } from '@prisma/client';
import { listingLanguages } from './listing-languages';

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
