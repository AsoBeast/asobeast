import { AppSnapshot, Store } from '@prisma/client';
import { listingFactsOf, listingTextsOf } from './listing-facts';

const row = (
  raw: AppSnapshot['raw'],
  dates: { releasedAt?: Date | null; storeUpdatedAt?: Date | null } = {},
) => ({
  raw,
  releasedAt: dates.releasedAt ?? null,
  storeUpdatedAt: dates.storeUpdatedAt ?? null,
});

const NO_FACTS = {
  genre: null,
  genreName: null,
  developer: null,
  developerId: null,
  contentRating: null,
  releasedAt: null,
  storeUpdatedAt: null,
};

const STORES = [Store.APP_STORE, Store.GOOGLE_PLAY];

describe('listingFactsOf', () => {
  it('reads the Google Play facts', () => {
    expect(
      listingFactsOf(
        Store.GOOGLE_PLAY,
        row(
          {
            genreId: 'TRAVEL_AND_LOCAL',
            genre: 'Travel & Local',
            developerId: '5700313618786177705',
            developer: 'IHG',
            contentRating: 'Everyone',
          },
          {
            releasedAt: new Date('2015-03-12T00:00:00.000Z'),
            storeUpdatedAt: new Date('2026-11-10T08:30:00.000Z'),
          },
        ),
      ),
    ).toEqual({
      genre: 'TRAVEL_AND_LOCAL',
      genreName: 'Travel & Local',
      developer: 'IHG',
      developerId: '5700313618786177705',
      contentRating: 'Everyone',
      releasedAt: '2015-03-12T00:00:00.000Z',
      storeUpdatedAt: '2026-11-10T08:30:00.000Z',
    });
  });

  it('reads the App Store facts', () => {
    expect(
      listingFactsOf(
        Store.APP_STORE,
        row({
          primaryGenreId: '6013',
          primaryGenre: 'Health & Fitness',
          artistId: 284882218,
          developer: '  Habit Labs ',
          contentRating: '4+',
        }),
      ),
    ).toMatchObject({
      genre: '6013',
      genreName: 'Health & Fitness',
      developerId: '284882218',
      developer: 'Habit Labs',
      contentRating: '4+',
    });
  });

  it.each(STORES)(
    'answers null for every fact a payload does not hold on %s',
    (store) => {
      expect(listingFactsOf(store, row({}))).toEqual(NO_FACTS);
    },
  );

  it.each(
    STORES.flatMap((store) =>
      [null, 'nope', []].map((raw) => [store, raw] as const),
    ),
  )('answers null for every fact of a %s payload %j', (store, raw) => {
    expect(listingFactsOf(store, row(raw))).toEqual(NO_FACTS);
  });

  it('never answers a blank string', () => {
    expect(
      listingFactsOf(
        Store.GOOGLE_PLAY,
        row({
          genreId: '',
          genre: '  ',
          developerId: ' ',
          developer: '   ',
          contentRating: '',
        }),
      ),
    ).toEqual(NO_FACTS);
  });

  it('answers a null date for a missing or invalid date', () => {
    expect(
      listingFactsOf(
        Store.APP_STORE,
        row({}, { releasedAt: null, storeUpdatedAt: new Date('not a date') }),
      ),
    ).toMatchObject({ releasedAt: null, storeUpdatedAt: null });
  });
});

describe('listingTextsOf', () => {
  const texts = (raw: AppSnapshot['raw'], description = 'Plan trips.') => ({
    raw,
    description,
  });

  it.each(STORES)('answers the description column on %s', (store) => {
    expect(listingTextsOf(store, texts({})).description).toBe('Plan trips.');
  });

  it('answers Google Play release notes as plain lines', () => {
    expect(
      listingTextsOf(
        Store.GOOGLE_PLAY,
        texts({ recentChanges: 'Fixes<br>Faster search' }),
      ).releaseNotes,
    ).toBe('Fixes\nFaster search');
  });

  it('answers App Store release notes trimmed', () => {
    expect(
      listingTextsOf(Store.APP_STORE, texts({ releaseNotes: '  Bug fixes.  ' }))
        .releaseNotes,
    ).toBe('Bug fixes.');
  });

  it.each([
    [Store.APP_STORE, {}],
    [Store.GOOGLE_PLAY, {}],
    [Store.APP_STORE, { releaseNotes: '   ' }],
    [Store.GOOGLE_PLAY, { recentChanges: 7 }],
    [Store.GOOGLE_PLAY, null],
  ])('answers null release notes when %s wrote none in %j', (store, raw) => {
    expect(listingTextsOf(store, texts(raw)).releaseNotes).toBeNull();
  });
});
