import { describe, expect, it } from 'vitest';
import { isSpiderTerm } from './spider';

describe('isSpiderTerm', () => {
  it('takes 2 to 40 characters after trimming', () => {
    expect(isSpiderTerm('ab')).toBe(true);
    expect(isSpiderTerm(' a ')).toBe(false);
    expect(isSpiderTerm('a'.repeat(40))).toBe(true);
    expect(isSpiderTerm('a'.repeat(41))).toBe(false);
  });

  it('counts a character outside the basic plane once', () => {
    expect(isSpiderTerm('😀')).toBe(false);
    expect(isSpiderTerm('😀'.repeat(21))).toBe(true);
    expect(isSpiderTerm('😀'.repeat(41))).toBe(false);
  });

  it('counts the term as the endpoint does, after lowercasing', () => {
    expect(isSpiderTerm('\u0130'.repeat(20))).toBe(true);
    expect(isSpiderTerm('\u0130'.repeat(21))).toBe(false);
  });

  it('leaves out a presentation selector as the endpoint does', () => {
    expect(isSpiderTerm('\u2764\uFE0F')).toBe(false);
    expect(isSpiderTerm('\u2764\uFE0F'.repeat(21))).toBe(true);
  });
});
