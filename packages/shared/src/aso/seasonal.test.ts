import { describe, expect, it } from 'vitest';

import { activeSeasonalEvents, SEASONAL_CALENDAR } from './seasonal';

const ids = (date: Date, leadDays = 0): string[] =>
  activeSeasonalEvents(date, leadDays).map((event) => event.id);

const utc = (month: number, day: number): Date =>
  new Date(Date.UTC(2026, month - 1, day, 12));

describe('SEASONAL_CALENDAR', () => {
  it('has all ten ported events', () => {
    expect(SEASONAL_CALENDAR).toHaveLength(10);
  });
});

describe('activeSeasonalEvents', () => {
  it('includes an event on its start and end boundaries', () => {
    expect(ids(utc(2, 1))).toContain('valentines-day');
    expect(ids(utc(2, 14))).toContain('valentines-day');
  });

  it('excludes an event the day after it ends', () => {
    expect(ids(utc(2, 15))).not.toContain('valentines-day');
  });

  it('handles the year-boundary wrap for New Year', () => {
    expect(ids(utc(12, 26))).toContain('new-year');
    expect(ids(utc(1, 7))).toContain('new-year');
    expect(ids(utc(1, 8))).not.toContain('new-year');
  });

  it('applies the lead time to upcoming events', () => {
    expect(ids(utc(1, 18), 14)).toContain('valentines-day');
    expect(ids(utc(1, 17), 14)).not.toContain('valentines-day');
  });

  it('excludes upcoming events without lead time', () => {
    expect(ids(utc(1, 20), 0)).not.toContain('valentines-day');
  });
});
