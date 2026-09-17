import { describe, expect, it } from 'vitest';

import { storefrontLanguage } from './languages';

describe('storefrontLanguage', () => {
  it.each([
    ['pl', 'pl'],
    ['US', 'en'],
    ['jp', 'ja'],
  ])('maps %s to %s', (country, language) => {
    expect(storefrontLanguage(country)).toBe(language);
  });

  it('returns null for a country outside the table', () => {
    expect(storefrontLanguage('zz')).toBeNull();
  });
});
