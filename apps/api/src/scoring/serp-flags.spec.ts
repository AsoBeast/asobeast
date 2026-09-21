import { brandTopTen, headTopTen, junkTopTen } from './scoring-fixtures';
import { serpFlags } from './serp-flags';

type TopTen = Parameters<typeof serpFlags>[0]['top10'];

const page = (topTen: TopTen, keywordText: string, resultCount = 30) => ({
  top10: topTen,
  keywordText,
  resultCount,
});

const titled = (titles: string[]): TopTen =>
  titles.map((title) => ({ title, ratingCount: 5_000 }));

const unrelated = (count: number): string[] =>
  Array.from({ length: count }, () => 'Weather');

describe('serpFlags', () => {
  it('flags a leader named after the keyword that dwarfs the page', () => {
    expect(serpFlags(page(brandTopTen(), 'geoguessr'))).toEqual([
      'brand',
      'padded',
    ]);
  });

  it('does not call a generic head term a brand', () => {
    const topTen = [
      {
        title: 'Trivia Crack: Brain Quiz Game',
        developer: 'Etermax',
        ratingCount: 748_153,
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        title: `Trivia ${index}`,
        ratingCount: 5_000,
      })),
    ];
    expect(serpFlags(page(topTen, 'trivia'))).toEqual([]);
  });

  it('needs ten thousand ratings on the leader', () => {
    const topTen = [
      { title: 'Where Am I - Find My Address', ratingCount: 3_618 },
      ...Array.from({ length: 9 }, (_, index) => ({
        title: `Where Am I ${index}`,
        ratingCount: 10,
      })),
    ];
    expect(serpFlags(page(topTen, 'where am i'))).toEqual([]);
  });

  it('accepts the developer name as the brand', () => {
    const topTen = [
      {
        title: 'Music for everyone',
        developer: 'Spotify AB',
        ratingCount: 30_000_000,
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        title: `Radio ${index}`,
        ratingCount: 2_000,
      })),
    ];
    expect(serpFlags(page(topTen, 'spotify'))).toContain('brand');
  });

  it.each([
    [0, true],
    [1, true],
    [3, true],
    [4, false],
  ])('%s results is a small page: %s', (resultCount, expected) => {
    const topTen = headTopTen().slice(0, Math.min(resultCount, 10));
    expect(
      serpFlags(page(topTen, 'quiz', resultCount)).includes('small_serp'),
    ).toBe(expected);
  });

  it.each([
    [99, true],
    [100, false],
    [undefined, false],
    [Number.NaN, false],
  ])('a leader with %s ratings is weak: %s', (ratingCount, expected) => {
    const topTen = [{ title: 'Quiz', ratingCount }, ...headTopTen().slice(1)];
    expect(serpFlags(page(topTen, 'quiz')).includes('weak_leader')).toBe(
      expected,
    );
  });

  it('raises no brand for a leader with an unknown count', () => {
    const topTen = [{ title: 'GeoGuessr' }, ...brandTopTen().slice(1)];
    expect(serpFlags(page(topTen, 'geoguessr'))).not.toContain('brand');
  });

  it.each([
    [titled(['Geo Quiz', 'Geo Quiz', ...unrelated(8)]), true],
    [titled(['Geo Quiz', 'Geo Quiz', 'Quiz Geo', ...unrelated(7)]), false],
  ])('pads a page at a factor of 0.5 and not above: %#', (topTen, expected) => {
    expect(serpFlags(page(topTen, 'geo quiz')).includes('padded')).toBe(
      expected,
    );
  });

  it('flags a padded page and keeps the declared order', () => {
    expect(serpFlags(page(junkTopTen(), 'videos put'))).toEqual(['padded']);
    expect(serpFlags(page([], 'kw3006', 0))).toEqual(['small_serp', 'padded']);
  });
});
