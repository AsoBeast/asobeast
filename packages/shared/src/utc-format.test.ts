import { describe, expect, it } from 'vitest';
import {
  formatUtcDate,
  formatUtcDateRange,
  formatUtcInstant,
} from './utc-format';

describe('formatUtcDate', () => {
  it.each([
    ['2026-10-24', '24 Oct 2026'],
    ['2026-10-24T03:10:00.000Z', '24 Oct 2026'],
    ['2026-03-05', '5 Mar 2026'],
    ['yesterday', 'yesterday'],
    ['2026-13-05', '2026-13-05'],
  ])('prints %s as %s', (input, expected) => {
    expect(formatUtcDate(input)).toBe(expected);
  });
});

describe('formatUtcDateRange', () => {
  it.each([
    ['2026-10-24', '2026-10-24', '24 Oct 2026'],
    ['2026-10-23', '2026-10-24', '23 to 24 Oct 2026'],
    ['2026-09-30', '2026-10-02', '30 Sep to 2 Oct 2026'],
    ['2025-12-28', '2026-01-03', '28 Dec 2025 to 3 Jan 2026'],
    [
      '2026-10-23T22:00:00.000Z',
      '2026-10-24T04:12:00.000Z',
      '23 to 24 Oct 2026',
    ],
    ['2026-10-24T01:00:00.000Z', '2026-10-24T09:00:00.000Z', '24 Oct 2026'],
    ['soon', '2026-10-24', 'soon to 2026-10-24'],
  ])('prints %s and %s as %s', (from, to, expected) => {
    expect(formatUtcDateRange(from, to)).toBe(expected);
  });
});

describe('formatUtcInstant', () => {
  it.each([
    ['2026-10-24T03:10:00.000Z', '24 Oct 2026, 03:10 UTC'],
    ['2026-10-24', '2026-10-24'],
    ['now', 'now'],
  ])('prints %s as %s', (input, expected) => {
    expect(formatUtcInstant(input)).toBe(expected);
  });
});
