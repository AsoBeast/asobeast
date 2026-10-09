import { seasonalSuggestions } from './seasonal-suggestions';

const utc = (month: number, day: number, year = 2026): Date =>
  new Date(Date.UTC(year, month - 1, day, 12));

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

  it('names the coming year in the end of year goals keyword', () => {
    const texts = seasonalSuggestions(utc(12, 20, 2027), empty, 30).map(
      (item) => item.text,
    );
    expect(texts).toContain('goals 2028');
    expect(texts).not.toContain('goals 2026');
  });

  it('does not suggest a year keyword the app already tracks', () => {
    const texts = seasonalSuggestions(
      utc(12, 20),
      new Set(['goals 2027']),
      30,
    ).map((item) => item.text);
    expect(texts).not.toContain('goals 2027');
  });
});
