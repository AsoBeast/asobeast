import { describe, expect, it } from 'vitest';
import { countMaxLengthChars } from './input-length';

describe('countMaxLengthChars', () => {
  it('counts plain characters one each', () => {
    expect(countMaxLengthChars('')).toBe(0);
    expect(countMaxLengthChars('habit tracker')).toBe(13);
  });

  it('counts an astral emoji once', () => {
    expect(countMaxLengthChars('😀'.repeat(500))).toBe(500);
  });

  it('counts a character with a presentation selector once', () => {
    expect(countMaxLengthChars('❤\uFE0F'.repeat(500))).toBe(500);
  });

  it('counts a zero width joiner sequence by its parts', () => {
    expect(countMaxLengthChars('👨\u200D👩\u200D👧')).toBe(5);
  });

  it('counts a flag as two regional indicators', () => {
    expect(countMaxLengthChars('🇵🇱')).toBe(2);
  });

  it('counts a combining mark as its own unit', () => {
    expect(countMaxLengthChars('e\u0301')).toBe(2);
  });
});
