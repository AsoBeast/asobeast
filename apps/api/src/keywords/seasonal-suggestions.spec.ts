import { seasonalSuggestions } from './seasonal-suggestions';

const utc = (month: number, day: number): Date =>
  new Date(Date.UTC(2026, month - 1, day, 12));

const empty = new Set<string>();

describe('seasonalSuggestions', () => {
  it('returns calendar keywords inside an active window', () => {
    const result = seasonalSuggestions(utc(2, 5), empty, 30);
    expect(result.every((item) => item.strategy === 'seasonal')).toBe(true);
    const valentine = result.find((item) => item.text === 'valentine');
    expect(valentine?.event).toBe("Valentine's Day");
  });

  it('suggests upcoming events within the 14 day lead time', () => {
    const result = seasonalSuggestions(utc(1, 20), empty, 30).map(
      (i) => i.text,
    );
    expect(result).toContain('valentine');
  });

  it('returns nothing outside any window or lead time', () => {
    expect(seasonalSuggestions(utc(1, 15), empty, 30)).toEqual([]);
  });

  it('filters already tracked keywords', () => {
    const tracked = new Set(['valentine']);
    const result = seasonalSuggestions(utc(2, 5), tracked, 30).map(
      (i) => i.text,
    );
    expect(result).not.toContain('valentine');
  });

  it('respects the limit', () => {
    expect(seasonalSuggestions(utc(2, 5), empty, 2)).toHaveLength(2);
  });
});
