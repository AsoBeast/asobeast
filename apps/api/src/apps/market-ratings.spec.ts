import { ListingMarket } from '@asobeast/shared';
import { NewestRating, withRatings } from './market-ratings';

const MARKETS: ListingMarket[] = [
  {
    country: 'us',
    home: true,
    capturedAt: '2026-07-01T00:00:00.000Z',
    tracked: true,
  },
  {
    country: 'de',
    home: false,
    capturedAt: '2026-07-02T00:00:00.000Z',
    tracked: false,
    localizations: ['de'],
  },
];

const NO_RATING = { ratingAvg: null, ratingCount: null };

describe('withRatings', () => {
  it('gives the home snapshot to the home market and a market snapshot to its market', () => {
    const newest: NewestRating[] = [
      { country: 'de', ratingAvg: 4.4, ratingCount: 5200 },
      { country: null, ratingAvg: 4.8, ratingCount: 24000 },
    ];

    expect(withRatings(MARKETS, newest, 'us')).toEqual([
      { ...MARKETS[0], ratingAvg: 4.8, ratingCount: 24000 },
      { ...MARKETS[1], ratingAvg: 4.4, ratingCount: 5200 },
    ]);
  });

  it('answers null for a market without a snapshot', () => {
    const newest: NewestRating[] = [
      { country: null, ratingAvg: 4.8, ratingCount: 24000 },
    ];

    expect(withRatings(MARKETS, newest, 'us')[1]).toEqual({
      ...MARKETS[1],
      ...NO_RATING,
    });
  });

  it('keeps a market whose snapshot carries no rating', () => {
    const newest: NewestRating[] = [{ country: 'de', ...NO_RATING }];

    expect(withRatings(MARKETS, newest, 'us')[1]).toEqual({
      ...MARKETS[1],
      ...NO_RATING,
    });
  });

  it('leaves every other field and the order of the markets untouched', () => {
    const newest: NewestRating[] = [
      { country: 'de', ratingAvg: 4.4, ratingCount: 5200 },
    ];

    const answered = withRatings(MARKETS, newest, 'us');

    expect(
      answered.map(({ country, home, capturedAt, tracked, localizations }) => ({
        country,
        home,
        capturedAt,
        tracked,
        localizations,
      })),
    ).toEqual(
      MARKETS.map((market) => ({ localizations: undefined, ...market })),
    );
  });

  it('answers null for every market without any snapshot', () => {
    expect(withRatings(MARKETS, [], 'us')).toEqual(
      MARKETS.map((market) => ({ ...market, ...NO_RATING })),
    );
  });
});
