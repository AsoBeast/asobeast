import { isRankedIn, rankedChartKey, rankedChartsOf } from './ranked-charts';

const FREE_APP = { collections: ['free', 'grossing'] as const, genre: '6017' };
const PAID_APP = { collections: ['paid', 'grossing'] as const, genre: '6014' };

describe('rankedChartsOf', () => {
  it('lists the price class and grossing charts in the category and overall', () => {
    expect(rankedChartsOf(FREE_APP)).toEqual([
      { collection: 'free', genre: '6017' },
      { collection: 'free', genre: 'overall' },
      { collection: 'grossing', genre: '6017' },
      { collection: 'grossing', genre: 'overall' },
    ]);
  });

  it('never lists the free chart for a paid app', () => {
    const charts = rankedChartsOf(PAID_APP);

    expect(charts).toEqual([
      { collection: 'paid', genre: '6014' },
      { collection: 'paid', genre: 'overall' },
      { collection: 'grossing', genre: '6014' },
      { collection: 'grossing', genre: 'overall' },
    ]);
    expect(charts.some((chart) => chart.collection === 'free')).toBe(false);
  });

  it('lists nothing for an app without collections', () => {
    expect(rankedChartsOf({ collections: [], genre: '6017' })).toEqual([]);
  });
});

describe('isRankedIn', () => {
  it('accepts every chart a free app is ranked in', () => {
    for (const chart of rankedChartsOf(FREE_APP)) {
      expect(isRankedIn(FREE_APP, chart)).toBe(true);
    }
  });

  it('refuses another kind, another category and an unknown genre', () => {
    expect(isRankedIn(FREE_APP, { collection: 'paid', genre: '6017' })).toBe(
      false,
    );
    expect(isRankedIn(FREE_APP, { collection: 'free', genre: '6014' })).toBe(
      false,
    );
    expect(isRankedIn(FREE_APP, { collection: 'free', genre: 'nope' })).toBe(
      false,
    );
  });
});

describe('rankedChartKey', () => {
  it('joins the collection and the genre', () => {
    expect(rankedChartKey({ collection: 'free', genre: 'overall' })).toBe(
      'free~overall',
    );
  });
});
