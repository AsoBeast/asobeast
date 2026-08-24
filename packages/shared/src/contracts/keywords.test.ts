import { describe, expect, it } from 'vitest';
import { keywordLabel } from './keywords';

describe('keywordLabel', () => {
  it('appends the market in upper case when a country is scoped', () => {
    expect(keywordLabel({ text: 'habit tracker', country: 'us' })).toBe(
      'habit tracker (US)',
    );
  });

  it('returns the text alone when no country is scoped', () => {
    expect(keywordLabel({ text: 'habit tracker' })).toBe('habit tracker');
  });

  it('treats an empty country as no market rather than an empty suffix', () => {
    expect(keywordLabel({ text: 'habit tracker', country: '' })).toBe(
      'habit tracker',
    );
  });
});
