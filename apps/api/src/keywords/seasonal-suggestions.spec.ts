import { seasonalSuggestions } from './seasonal-suggestions';

const utc = (month: number, day: number, year = 2026): Date =>
  new Date(Date.UTC(year, month - 1, day, 12));

const empty = new Set<string>();

const textsOf = (
  now: Date,
  country: string,
  tracked = empty,
  limit = 30,
): string[] =>
  seasonalSuggestions(now, country, tracked, limit).map((item) => item.text);

describe('seasonalSuggestions', () => {
  it('returns calendar keywords inside an active window', () => {
    const result = seasonalSuggestions(utc(2, 5), 'us', empty, 30);
    expect(result.every((item) => item.strategy === 'seasonal')).toBe(true);
    const valentine = result.find((item) => item.text === 'valentine');
    expect(valentine?.event).toBe("Valentine's Day");
  });

  it('suggests upcoming events within the 14 day lead time', () => {
    expect(textsOf(utc(1, 20), 'us')).toContain('valentine');
  });

  it('returns nothing outside any window or lead time', () => {
    expect(seasonalSuggestions(utc(1, 15), 'us', empty, 30)).toEqual([]);
  });

  it('filters already tracked keywords', () => {
    expect(textsOf(utc(2, 5), 'us', new Set(['valentine']))).not.toContain(
      'valentine',
    );
  });

  it('respects the limit', () => {
    expect(seasonalSuggestions(utc(2, 5), 'us', empty, 2)).toHaveLength(2);
  });

  it('names the coming year in the end of year goals keyword', () => {
    const texts = textsOf(utc(12, 20, 2027), 'us');
    expect(texts).toContain('goals 2028');
    expect(texts).not.toContain('goals 2026');
  });

  it('does not suggest a year keyword the app already tracks', () => {
    expect(textsOf(utc(12, 20), 'us', new Set(['goals 2027']))).not.toContain(
      'goals 2027',
    );
  });

  it('offers Halloween keywords in a storefront that observes it', () => {
    expect(textsOf(utc(10, 9), 'gb')).toEqual(
      expect.arrayContaining(['halloween', 'scary', 'spooky']),
    );
  });

  it('offers nothing in a storefront that does not observe the event', () => {
    expect(textsOf(utc(10, 9), 'kr')).toEqual([]);
    expect(textsOf(utc(12, 20), 'jp')).toEqual([]);
  });
});
