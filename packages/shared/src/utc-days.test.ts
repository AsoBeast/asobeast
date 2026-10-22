import { describe, expect, it } from 'vitest';
import { addUtcDays } from './utc-days';

describe('addUtcDays', () => {
  it('adds days in utc', () => {
    expect(addUtcDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addUtcDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
