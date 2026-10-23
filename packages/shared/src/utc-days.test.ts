import { describe, expect, it } from 'vitest';
import { addUtcDays, utcDayOf } from './utc-days';

describe('addUtcDays', () => {
  it('adds days in utc', () => {
    expect(addUtcDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addUtcDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('utcDayOf', () => {
  it('reads the utc day of an instant', () => {
    expect(utcDayOf(new Date('2026-10-22T23:59:59.999Z'))).toBe('2026-10-22');
    expect(utcDayOf(Date.parse('2026-10-23T00:00:00.000Z'))).toBe('2026-10-23');
  });
});
