import { describe, expect, it } from 'vitest';

import {
  activeSeasonalEvents,
  SEASONAL_CALENDAR,
  SEASONAL_LEAD_DAYS,
  seasonalKeywords,
} from './seasonal';

const ids = (date: Date, leadDays = 0): string[] =>
  activeSeasonalEvents(date, leadDays).map((event) => event.id);

const utc = (month: number, day: number, year = 2026): Date =>
  new Date(Date.UTC(year, month - 1, day, 12));

const keywordsOn = (date: Date): string[] =>
  activeSeasonalEvents(date, SEASONAL_LEAD_DAYS).flatMap((event) =>
    seasonalKeywords(event, date),
  );

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

describe('seasonalKeywords', () => {
  it('names the coming year in the end of year goals keyword', () => {
    expect(keywordsOn(utc(12, 20, 2027))).toContain('goals 2028');
    expect(keywordsOn(utc(12, 20, 2027))).not.toContain('goals 2026');
  });

  it('starts naming the coming year on the first day of the lead time', () => {
    expect(keywordsOn(utc(12, 13))).toContain('goals 2027');
    expect(keywordsOn(utc(12, 12))).not.toContain('goals 2027');
  });

  it('names the coming year until the last second of the year', () => {
    const lastSecond = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));
    expect(keywordsOn(lastSecond)).toContain('goals 2027');
  });

  it('drops the year keyword once the new year has begun', () => {
    const newYear = new Date(Date.UTC(2027, 0, 1, 0, 0, 0));
    expect(ids(newYear, SEASONAL_LEAD_DAYS)).not.toContain('end-of-year');
    expect(keywordsOn(newYear)).not.toContain('goals 2027');
  });

  it('keeps a year keyword only on events that sit inside December', () => {
    const withYear = SEASONAL_CALENDAR.filter(
      (event) => event.nextYearKeywords,
    );
    expect(withYear.length).toBeGreaterThan(0);
    for (const event of withYear) {
      expect([event.start.month, event.end.month]).toEqual([12, 12]);
    }
  });

  it('leaves an event without year keywords unchanged', () => {
    const halloween = SEASONAL_CALENDAR.find(
      (event) => event.id === 'halloween',
    );
    expect(seasonalKeywords(halloween!, utc(10, 9))).toEqual(
      halloween!.keywords,
    );
  });
});

describe('lead time across February', () => {
  it('starts the lead time of March events a day later in a leap year', () => {
    expect(ids(utc(2, 16, 2028), SEASONAL_LEAD_DAYS)).toContain(
      'spring-easter',
    );
    expect(ids(utc(2, 15, 2028), SEASONAL_LEAD_DAYS)).not.toContain(
      'spring-easter',
    );
    expect(ids(utc(2, 15, 2027), SEASONAL_LEAD_DAYS)).toContain(
      'spring-easter',
    );
    expect(ids(utc(2, 14, 2027), SEASONAL_LEAD_DAYS)).not.toContain(
      'spring-easter',
    );
  });
});
