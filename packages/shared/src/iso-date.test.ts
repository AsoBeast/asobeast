import { describe, expect, it } from 'vitest';
import { isoDateOrNull } from './iso-date';

describe('isoDateOrNull', () => {
  it('keeps an ISO day and an ISO instant', () => {
    expect(isoDateOrNull('2026-11-20')).toBe('2026-11-20');
    expect(isoDateOrNull('2026-11-20T09:00:00Z')).toBe('2026-11-20T09:00:00Z');
    expect(isoDateOrNull('2026-11-20T09:00:00.000Z')).toBe(
      '2026-11-20T09:00:00.000Z',
    );
    expect(isoDateOrNull('2026-11-20T09:00+02:00')).toBe(
      '2026-11-20T09:00+02:00',
    );
    expect(isoDateOrNull('2026-11-20T09:00:00-05:00')).toBe(
      '2026-11-20T09:00:00-05:00',
    );
  });

  it('answers null for text that is not an ISO date', () => {
    expect(isoDateOrNull('in November')).toBeNull();
    expect(isoDateOrNull('soon')).toBeNull();
    expect(isoDateOrNull('20/11/2026')).toBeNull();
    expect(isoDateOrNull('2026-11-20 09:00')).toBeNull();
    expect(isoDateOrNull('Nov 20, 2026')).toBeNull();
    expect(isoDateOrNull('')).toBeNull();
  });

  it('answers null for a date that is not a real day', () => {
    expect(isoDateOrNull('2026-02-30')).toBeNull();
    expect(isoDateOrNull('2026-13-01')).toBeNull();
    expect(isoDateOrNull('2026-11-32')).toBeNull();
    expect(isoDateOrNull('2026-11-20T25:00:00Z')).toBeNull();
  });

  it('answers null for a value that is not a string', () => {
    expect(isoDateOrNull(null)).toBeNull();
    expect(isoDateOrNull(7)).toBeNull();
    expect(isoDateOrNull(undefined)).toBeNull();
  });

  it('refuses an instant without an offset that would read local', () => {
    expect(isoDateOrNull('2026-11-20T09:00:00')).toBeNull();
  });
});
