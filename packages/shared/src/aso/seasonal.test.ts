import { describe, expect, it } from 'vitest';

import { STOREFRONT_LANGUAGES } from '../storefronts/languages';

import {
  activeSeasonalEvents,
  SEASONAL_CALENDAR,
  SEASONAL_LEAD_DAYS,
  seasonalKeywords,
} from './seasonal';

const ids = (date: Date, leadDays = 0, country?: string): string[] =>
  activeSeasonalEvents(date, leadDays, country).map((event) => event.id);

const utc = (month: number, day: number, year = 2026): Date =>
  new Date(Date.UTC(year, month - 1, day, 12));

const keywordsOn = (date: Date, country: string): string[] =>
  activeSeasonalEvents(date, SEASONAL_LEAD_DAYS, country).flatMap((event) =>
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
    expect(keywordsOn(utc(12, 20, 2027), 'us')).toContain('goals 2028');
    expect(keywordsOn(utc(12, 20, 2027), 'us')).not.toContain('goals 2026');
  });

  it('starts naming the coming year on the first day of the lead time', () => {
    expect(keywordsOn(utc(12, 13), 'us')).toContain('goals 2027');
    expect(keywordsOn(utc(12, 12), 'us')).not.toContain('goals 2027');
  });

  it('names the coming year until the last second of the year', () => {
    const lastSecond = new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999));
    expect(keywordsOn(lastSecond, 'us')).toContain('goals 2027');
  });

  it('drops the year keyword once the new year has begun', () => {
    const newYear = new Date(Date.UTC(2027, 0, 1, 0, 0, 0));
    expect(ids(newYear, SEASONAL_LEAD_DAYS, 'us')).not.toContain('end-of-year');
    expect(keywordsOn(newYear, 'us')).not.toContain('goals 2027');
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
    if (!halloween) throw new Error('halloween is not in the calendar');
    expect(seasonalKeywords(halloween, utc(10, 9))).toEqual(halloween.keywords);
  });
});

describe('lead time across February', () => {
  it('starts the lead time of March events a day later in a leap year', () => {
    expect(ids(utc(2, 16, 2028), SEASONAL_LEAD_DAYS, 'us')).toContain(
      'spring-easter',
    );
    expect(ids(utc(2, 15, 2028), SEASONAL_LEAD_DAYS, 'us')).not.toContain(
      'spring-easter',
    );
    expect(ids(utc(2, 15, 2027), SEASONAL_LEAD_DAYS, 'us')).toContain(
      'spring-easter',
    );
    expect(ids(utc(2, 14, 2027), SEASONAL_LEAD_DAYS, 'us')).not.toContain(
      'spring-easter',
    );
  });
});

describe('moveable dates', () => {
  const years = Array.from({ length: 75 }, (_, index) => 2026 + index);

  const secondSundayOfMay = (year: number): Date => {
    const firstOfMay = new Date(Date.UTC(year, 4, 1, 12));
    const daysToFirstSunday = (7 - firstOfMay.getUTCDay()) % 7;
    return new Date(Date.UTC(year, 4, 1 + daysToFirstSunday + 7, 12));
  };

  const fridayAfterThanksgiving = (year: number): Date => {
    const firstOfNovember = new Date(Date.UTC(year, 10, 1, 12));
    const daysToFirstThursday = (4 - firstOfNovember.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, 10, 1 + daysToFirstThursday + 22, 12));
  };

  const easterSunday = (year: number): Date => {
    const golden = year % 19;
    const century = Math.floor(year / 100);
    const yearOfCentury = year % 100;
    const shift =
      (19 * golden +
        century -
        Math.floor(century / 4) -
        Math.floor((century - Math.floor((century + 8) / 25) + 1) / 3) +
        15) %
      30;
    const weekday =
      (32 +
        2 * (century % 4) +
        2 * Math.floor(yearOfCentury / 4) -
        shift -
        (yearOfCentury % 4)) %
      7;
    const correction = Math.floor((golden + 11 * shift + 22 * weekday) / 451);
    const monthDay = shift + weekday - 7 * correction + 114;
    return new Date(
      Date.UTC(year, Math.floor(monthDay / 31) - 1, (monthDay % 31) + 1, 12),
    );
  };

  const yearsMissing = (eventId: string, dateIn: (year: number) => Date) =>
    years.filter((year) => !ids(dateIn(year)).includes(eventId));

  it("keeps Mother's Day inside its window in every year", () => {
    expect(yearsMissing('mothers-day', secondSundayOfMay)).toEqual([]);
  });

  it('keeps Black Friday inside its window in every year', () => {
    expect(yearsMissing('black-friday', fridayAfterThanksgiving)).toEqual([]);
  });

  it('keeps Easter inside its window in every year', () => {
    expect(yearsMissing('spring-easter', easterSunday)).toEqual([]);
  });
});

describe('storefront scope', () => {
  it('offers Halloween where it is observed', () => {
    for (const country of ['us', 'ca', 'gb', 'ie', 'au', 'nz']) {
      expect(ids(utc(10, 9), SEASONAL_LEAD_DAYS, country)).toContain(
        'halloween',
      );
    }
  });

  it('offers no Halloween in an English storefront that does not observe it', () => {
    for (const country of ['in', 'sg', 'za', 'ph']) {
      expect(ids(utc(10, 9), SEASONAL_LEAD_DAYS, country)).not.toContain(
        'halloween',
      );
    }
  });

  it('offers nothing in a storefront whose language the keywords are not written in', () => {
    for (const country of ['kr', 'jp', 'de', 'fr', 'sa', 'tw']) {
      for (let day = 0; day < 365; day += 1) {
        const date = new Date(Date.UTC(2026, 0, 1 + day, 12));
        expect(ids(date, SEASONAL_LEAD_DAYS, country)).toEqual([]);
      }
    }
  });

  it('reads a country code in any case', () => {
    expect(ids(utc(10, 9), SEASONAL_LEAD_DAYS, 'GB')).toContain('halloween');
  });

  it('offers nothing for a country that is not a known storefront', () => {
    expect(ids(utc(12, 20), SEASONAL_LEAD_DAYS, 'zz')).toEqual([]);
  });

  it("keeps Mother's Day in May out of the United Kingdom and Ireland", () => {
    for (const country of ['gb', 'ie']) {
      expect(ids(utc(5, 5), SEASONAL_LEAD_DAYS, country)).not.toContain(
        'mothers-day',
      );
    }
    expect(ids(utc(5, 5), SEASONAL_LEAD_DAYS, 'us')).toContain('mothers-day');
  });

  it('keeps the northern seasons out of the southern hemisphere', () => {
    for (const country of ['au', 'nz', 'za']) {
      expect(ids(utc(7, 20), SEASONAL_LEAD_DAYS, country)).not.toContain(
        'summer',
      );
      expect(ids(utc(8, 1), SEASONAL_LEAD_DAYS, country)).not.toContain(
        'back-to-school',
      );
    }
  });

  it('applies every event to all storefronts when no country is given', () => {
    expect(ids(utc(10, 9))).toContain('halloween');
    expect(ids(utc(12, 20), SEASONAL_LEAD_DAYS)).toContain('end-of-year');
  });

  it('lists only English storefronts, because every keyword is English', () => {
    for (const event of SEASONAL_CALENDAR) {
      expect(event.storefronts.length).toBeGreaterThan(0);
      for (const country of event.storefronts) {
        expect(STOREFRONT_LANGUAGES[country]).toBe('en');
      }
    }
  });
});
