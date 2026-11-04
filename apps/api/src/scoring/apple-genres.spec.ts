import { inferPopularityGenre, popularityGenreOf } from './apple-genres';

const results = (...genreIds: Array<string | undefined>) =>
  genreIds.map((genreId) => ({ genreId }));

describe('inferPopularityGenre', () => {
  it('takes the majority among the mapped results', () => {
    expect(
      inferPopularityGenre(results('6014', '6017', '6014', undefined, '9999')),
    ).toBe('GAMES');
  });

  it('folds finer store genres into one popularity genre', () => {
    expect(inferPopularityGenre(results('6002', '6007', '6014'))).toBe(
      'PRODUCTIVITY_UTILITIES',
    );
  });

  it('only lets the first ten results vote', () => {
    const page = [
      ...results('6014'),
      ...Array.from({ length: 9 }, () => ({})),
      ...results('6004', '6004'),
    ];
    expect(inferPopularityGenre(page)).toBe('GAMES');
  });

  it('has no genre when nothing maps', () => {
    expect(inferPopularityGenre(results(undefined, '9999'))).toBeUndefined();
    expect(inferPopularityGenre([])).toBeUndefined();
  });
});

describe('popularityGenreOf', () => {
  it('maps a store genre given as a number or as text', () => {
    expect(popularityGenreOf(6013)).toBe('HEALTH_FITNESS');
    expect(popularityGenreOf('6013')).toBe('HEALTH_FITNESS');
  });

  it('has no genre for an unmapped or missing store genre', () => {
    expect(popularityGenreOf(6019)).toBeUndefined();
    expect(popularityGenreOf(null)).toBeUndefined();
  });
});
