import { describe, expect, it } from 'vitest';

import { marketLanguages } from './market-languages';

describe('marketLanguages', () => {
  it.each([
    ['ar', ['es']],
    ['mx', ['es']],
    ['br', ['pt']],
    ['pt', ['pt']],
    ['se', ['sv']],
    ['no', ['no']],
    ['dk', ['da']],
    ['fi', ['fi']],
    ['nl', ['nl']],
    ['pl', ['pl']],
    ['at', ['de']],
    ['it', ['it']],
    ['ca', ['fr']],
    ['jp', ['ja']],
    ['tr', ['tr']],
    ['id', ['id']],
    ['ro', ['ro']],
    ['cz', ['cs']],
  ])('reads %s as %j', (country, languages) => {
    expect(marketLanguages(country)).toEqual(languages);
  });

  it.each([
    ['ch', ['de', 'fr', 'it']],
    ['be', ['nl', 'fr']],
    ['lu', ['fr', 'de']],
    ['es', ['es', 'ca']],
    ['ru', ['ru', 'uk']],
  ])('reads the languages of %s together', (country, languages) => {
    expect([...marketLanguages(country)].sort()).toEqual([...languages].sort());
  });

  it.each(['us', 'gb', 'au', 'nz', 'ie', 'sg', 'za', 'ph'])(
    'leaves %s to english',
    (country) => {
      expect(marketLanguages(country)).toEqual(country === 'sg' ? ['zh'] : []);
    },
  );

  it('does not hand the many additional languages of the us to us listings', () => {
    expect(marketLanguages('us')).toEqual([]);
  });

  it('reads an upper case country', () => {
    expect(marketLanguages('MX')).toEqual(['es']);
  });

  it('reads a country outside both tables as english', () => {
    expect(marketLanguages('zz')).toEqual([]);
  });
});
