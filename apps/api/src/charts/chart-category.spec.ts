import { chartCategoryKey, oldestCategories } from './chart-category';

const row = (genre: string, collection: string, country = 'us') => ({
  store: 'APP_STORE' as const,
  country,
  genre,
  device: 'iphone',
  collection,
});

describe('chartCategoryKey', () => {
  it('names a category by store, country, genre and device', () => {
    expect(chartCategoryKey(row('6014', 'free'))).toBe(
      'APP_STORE~us~6014~iphone',
    );
  });

  it('gives every kind of one category the same key', () => {
    expect(chartCategoryKey(row('6014', 'free'))).toBe(
      chartCategoryKey(row('6014', 'grossing')),
    );
  });
});

describe('oldestCategories', () => {
  it('counts a category with three rows once', () => {
    const rows = [
      row('6014', 'free'),
      row('6014', 'paid'),
      row('6014', 'grossing'),
      row('6007', 'free'),
    ];

    expect(oldestCategories(rows, 2)).toEqual(rows);
  });

  it('drops a category past the limit whole', () => {
    const rows = [
      row('6014', 'free'),
      row('6007', 'free'),
      row('6005', 'free'),
      row('6000', 'free'),
      row('6000', 'paid'),
    ];

    expect(oldestCategories(rows, 3)).toEqual(rows.slice(0, 3));
  });

  it('keeps a later row of an early category past the limit', () => {
    const rows = [
      row('6014', 'free'),
      row('6007', 'free'),
      row('6014', 'grossing'),
    ];

    expect(oldestCategories(rows, 1)).toEqual([rows[0], rows[2]]);
  });

  it('tells storefronts apart', () => {
    const rows = [row('6014', 'free', 'us'), row('6014', 'free', 'de')];

    expect(oldestCategories(rows, 1)).toEqual([rows[0]]);
  });

  it('keeps every row without a limit', () => {
    const rows = [row('6014', 'free'), row('6007', 'free')];

    expect(oldestCategories(rows, null)).toBe(rows);
  });

  it('keeps nothing at a limit of zero', () => {
    expect(oldestCategories([row('6014', 'free')], 0)).toEqual([]);
  });

  it('answers an empty list for no rows', () => {
    expect(oldestCategories([], 3)).toEqual([]);
  });
});
