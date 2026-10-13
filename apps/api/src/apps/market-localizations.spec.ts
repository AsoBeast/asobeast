import {
  additionalLocalizations,
  capturedLocalizations,
} from './market-localizations';

describe('capturedLocalizations', () => {
  it.each([
    ['ch', ['fr', 'it', 'de', 'ja'], ['fr', 'it']],
    ['pl', ['pl', 'de'], ['pl']],
    ['pl', [], ['pl']],
    ['es', ['ca'], ['ca']],
    ['ru', ['uk'], ['uk']],
    ['us', ['es-MX'], ['es-MX']],
    ['de', [], []],
    ['de', ['xx', 'de'], []],
    ['zz', ['fr'], []],
  ])(
    'captures in %s shipping %j the localizations %j',
    (market, shipped, expected) => {
      expect(capturedLocalizations(market, shipped)).toEqual(expected);
    },
  );

  it('keeps the read order of the storefront', () => {
    expect(capturedLocalizations('ch', ['it', 'en-GB', 'fr'])).toEqual([
      'en-GB',
      'fr',
      'it',
    ]);
  });
});

describe('additionalLocalizations', () => {
  it('leaves out the default a storefront reads', () => {
    expect(additionalLocalizations('ch')).toEqual(['en-GB', 'fr', 'it']);
    expect(additionalLocalizations('zz')).toEqual([]);
  });
});
