import {
  appMarkets,
  homeLocalization,
  readsKeywordField,
} from './localization-markets';

describe('homeLocalization', () => {
  it.each([
    ['us', 'en-US'],
    ['mx', 'es-MX'],
    ['jp', 'ja'],
    ['de', 'de'],
  ] as const)(
    'is the default localization of the %s storefront',
    (country, expected) => {
      expect(homeLocalization(country)).toBe(expected);
    },
  );

  it('is English (U.K.) for a country that is no storefront', () => {
    expect(homeLocalization('zz')).toBe('en-GB');
  });
});

describe('readsKeywordField', () => {
  it.each([
    ['us', 'en-US'],
    ['us', 'es-MX'],
    ['mx', 'es-MX'],
    ['mx', 'en-GB'],
  ])(
    'reads the primary and every additional localization of a storefront (%s, %s)',
    (country, localization) => {
      expect(readsKeywordField(country, localization)).toBe(true);
    },
  );

  it.each([
    ['us', 'en-GB'],
    ['gb', 'es-MX'],
    ['de', 'es-MX'],
  ])(
    'does not read a localization the storefront leaves out (%s, %s)',
    (country, localization) => {
      expect(readsKeywordField(country, localization)).toBe(false);
    },
  );

  it('reads English (U.K.) in a country that is no storefront, as keywordFieldLocalizations answers', () => {
    expect(readsKeywordField('zz', 'en-GB')).toBe(true);
    expect(readsKeywordField('zz', 'en-US')).toBe(false);
  });
});

describe('appMarkets', () => {
  it('puts the home market first and the others in code order', () => {
    expect(appMarkets('us', ['mx', 'de'])).toEqual(['us', 'de', 'mx']);
  });

  it('drops duplicates and the home market from the others', () => {
    expect(appMarkets('us', ['mx', 'us', 'de', 'mx'])).toEqual([
      'us',
      'de',
      'mx',
    ]);
  });

  it('answers the home market alone when no keyword market exists', () => {
    expect(appMarkets('us', [])).toEqual(['us']);
  });
});
