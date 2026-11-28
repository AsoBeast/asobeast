import {
  appMarkets,
  homeLocalizationOf,
  readersOf,
  readerRole,
  readsKeywordField,
  trackInError,
} from './localization-markets';

const app = { country: 'us', defaultLocalization: null };

describe('homeLocalizationOf', () => {
  it.each([
    ['us', 'en-US'],
    ['mx', 'es-MX'],
    ['jp', 'ja'],
    ['de', 'de'],
  ] as const)(
    'is the default localization of the %s storefront',
    (country, expected) => {
      expect(homeLocalizationOf({ country })).toBe(expected);
    },
  );

  it('is English (U.K.) for a country that is no storefront', () => {
    expect(homeLocalizationOf({ country: 'zz' })).toBe('en-GB');
  });

  it('is the recorded default of a native only listing', () => {
    expect(
      homeLocalizationOf({ country: 'pl', defaultLocalization: 'pl' }),
    ).toBe('pl');
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
      expect(readsKeywordField(app, country, localization)).toBe(true);
    },
  );

  it.each([
    ['us', 'en-GB'],
    ['gb', 'es-MX'],
    ['de', 'es-MX'],
  ])(
    'does not read a localization the storefront leaves out (%s, %s)',
    (country, localization) => {
      expect(readsKeywordField(app, country, localization)).toBe(false);
    },
  );

  it('reads English (U.K.) in a country that is no storefront, as keywordFieldLocalizations answers', () => {
    expect(readsKeywordField(app, 'zz', 'en-GB')).toBe(true);
    expect(readsKeywordField(app, 'zz', 'en-US')).toBe(false);
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

describe('readerRole', () => {
  it('is default for the first localization the storefront reads', () => {
    expect(readerRole(app, 'us', 'en-US')).toBe('default');
    expect(readerRole(app, 'mx', 'es-MX')).toBe('default');
  });

  it('is additional for the others', () => {
    expect(readerRole(app, 'us', 'es-MX')).toBe('additional');
    expect(readerRole(app, 'mx', 'en-GB')).toBe('additional');
    expect(readerRole(app, 'de', 'en-GB')).toBe('additional');
  });

  it('is null when the storefront does not read it', () => {
    expect(readerRole(app, 'us', 'en-GB')).toBeNull();
    expect(readerRole(app, 'de', 'es-MX')).toBeNull();
  });

  it('is default for English (U.K.) in a country that is no storefront', () => {
    expect(readerRole(app, 'zz', 'en-GB')).toBe('default');
    expect(readerRole(app, 'zz', 'en-US')).toBeNull();
  });
});

describe('readersOf', () => {
  it('lists the markets that read a localization in the order given', () => {
    expect(readersOf(app, 'es-MX', ['us', 'de', 'mx'])).toEqual([
      { country: 'us', role: 'additional', home: true },
      { country: 'mx', role: 'default', home: false },
    ]);
  });

  it('marks only the home market as home', () => {
    expect(readersOf(app, 'en-GB', ['us', 'de', 'mx'])).toEqual([
      { country: 'de', role: 'additional', home: false },
      { country: 'mx', role: 'additional', home: false },
    ]);
  });

  it('is empty when no market reads the localization', () => {
    expect(
      readersOf({ country: 'jp', defaultLocalization: null }, 'fr', [
        'jp',
        'de',
      ]),
    ).toEqual([]);
  });
});

describe('trackInError', () => {
  const markets = ['us', 'mx'];

  it('accepts an empty trackIn', () => {
    expect(trackInError(app, 'es-MX', [], markets)).toBeNull();
  });

  it('accepts every app market that reads the localization', () => {
    expect(trackInError(app, 'es-MX', ['us', 'mx'], markets)).toBeNull();
  });

  it('names a country that is not one of the app markets', () => {
    expect(trackInError(app, 'es-MX', ['de'], markets)).toBe(
      "DE is not one of this app's markets",
    );
  });

  it('names an app market whose storefront does not read the localization', () => {
    expect(trackInError(app, 'en-US', ['us', 'mx'], markets)).toBe(
      'The MX storefront does not read English (U.S.)',
    );
  });

  it('reports the first offending country in the order it was sent', () => {
    expect(trackInError(app, 'en-US', ['mx', 'de'], markets)).toBe(
      'The MX storefront does not read English (U.S.)',
    );
  });

  it('checks the market list before it checks what the storefront reads', () => {
    expect(trackInError(app, 'en-US', ['de'], markets)).toBe(
      "DE is not one of this app's markets",
    );
  });
});
