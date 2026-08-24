import { Store } from '@prisma/client';
import {
  developerId,
  extractAppStoreRawFacts,
  extractGooglePlayRawFacts,
  extractRawFacts,
  isPaid,
  primaryGenreId,
  primaryGenreKey,
  primaryGenreName,
  ratingHistogram,
  releaseNotesFor,
  screenshotsCount,
} from './raw-facts';

const realPayload = {
  id: 1234567890,
  title: 'Habit Tracker: Daily Goals',
  description: 'Build better habits every day.',
  icon: 'https://example.com/icon.png',
  genres: ['Health & Fitness', 'Productivity'],
  genreIds: ['6013', '6007'],
  primaryGenreId: 6013,
  primaryGenre: 'Health & Fitness',
  price: 0,
  contentRating: '4+',
  languages: ['EN', 'ES', 'FR'],
  releaseNotes: 'Bug fixes and performance improvements.',
  version: '2.4.1',
  screenshots: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'],
  ipadScreenshots: ['ipad-a.png', 'ipad-b.png'],
  appletvScreenshots: [],
};

const gplayPayload = {
  appId: 'com.example.app',
  title: 'Example',
  genre: 'Tools',
  genreId: 'TOOLS',
  categories: [
    { name: 'Tools', id: 'TOOLS' },
    { name: 'Productivity', id: 'PRODUCTIVITY' },
  ],
  price: 0,
  contentRating: 'Everyone',
  recentChanges: 'New features',
  screenshots: ['a', 'b', 'c'],
  video: 'https://video',
};

describe('extractAppStoreRawFacts', () => {
  it('extracts facts from a real payload shape', () => {
    expect(extractAppStoreRawFacts(realPayload)).toEqual({
      screenshotCount: 5,
      ipadScreenshotCount: 2,
      genres: ['Health & Fitness', 'Productivity'],
      releaseNotes: 'Bug fixes and performance improvements.',
      languages: ['EN', 'ES', 'FR'],
      contentRating: '4+',
      genreKey: '6013',
      genreName: 'Health & Fitness',
      hasVideo: null,
      iconUrl: 'https://example.com/icon.png',
      screenshotUrls: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'],
    });
  });

  it('returns empty facts for garbage without throwing', () => {
    for (const garbage of [null, undefined, 42, 'nope', [], {}]) {
      expect(() => extractAppStoreRawFacts(garbage)).not.toThrow();
    }
    expect(extractAppStoreRawFacts({})).toEqual({
      screenshotCount: null,
      ipadScreenshotCount: null,
      genres: [],
      releaseNotes: null,
      languages: [],
      contentRating: null,
      genreKey: null,
      genreName: null,
      hasVideo: null,
      iconUrl: null,
      screenshotUrls: [],
    });
  });

  it('ignores non-string array entries and blank strings', () => {
    const facts = extractAppStoreRawFacts({
      genres: ['Games', 42, null],
      languages: 'EN',
      releaseNotes: '   ',
      screenshots: 'not-an-array',
    });
    expect(facts.genres).toEqual(['Games']);
    expect(facts.languages).toEqual([]);
    expect(facts.releaseNotes).toBeNull();
    expect(facts.screenshotCount).toBeNull();
  });
});

describe('extractGooglePlayRawFacts', () => {
  it('extracts facts from a Play payload shape', () => {
    expect(extractGooglePlayRawFacts(gplayPayload)).toEqual({
      screenshotCount: 3,
      ipadScreenshotCount: null,
      genres: ['Tools', 'Productivity'],
      releaseNotes: 'New features',
      languages: [],
      contentRating: 'Everyone',
      genreKey: 'TOOLS',
      genreName: 'Tools',
      hasVideo: true,
      iconUrl: null,
      screenshotUrls: ['a', 'b', 'c'],
    });
  });

  it('reports no video when the video field is absent', () => {
    const facts = extractGooglePlayRawFacts({
      ...gplayPayload,
      video: undefined,
    });
    expect(facts.hasVideo).toBe(false);
  });

  it('returns empty facts for garbage without throwing', () => {
    expect(extractGooglePlayRawFacts(null)).toEqual({
      screenshotCount: null,
      ipadScreenshotCount: null,
      genres: [],
      releaseNotes: null,
      languages: [],
      contentRating: null,
      genreKey: null,
      genreName: null,
      hasVideo: null,
      iconUrl: null,
      screenshotUrls: [],
    });
  });
});

describe('extractRawFacts dispatcher', () => {
  it('routes to the store-specific extractor', () => {
    expect(extractRawFacts(Store.APP_STORE, realPayload).hasVideo).toBeNull();
    expect(extractRawFacts(Store.GOOGLE_PLAY, gplayPayload).hasVideo).toBe(
      true,
    );
  });
});

describe('genre and price facts', () => {
  it('reads the primary genre id, key, name, and paid flag per store', () => {
    expect(primaryGenreId(realPayload)).toBe(6013);
    expect(primaryGenreKey(Store.APP_STORE, realPayload)).toBe('6013');
    expect(primaryGenreName(Store.APP_STORE, realPayload)).toBe(
      'Health & Fitness',
    );
    expect(primaryGenreKey(Store.GOOGLE_PLAY, gplayPayload)).toBe('TOOLS');
    expect(primaryGenreName(Store.GOOGLE_PLAY, gplayPayload)).toBe('Tools');
    expect(isPaid(realPayload)).toBe(false);
  });

  it('treats a positive price as paid', () => {
    expect(isPaid({ price: 2.99 })).toBe(true);
    expect(isPaid({ price: 0 })).toBe(false);
  });

  it('returns null for missing or invalid genre facts', () => {
    for (const garbage of [
      null,
      undefined,
      42,
      'nope',
      {},
      { primaryGenre: '  ' },
    ]) {
      expect(primaryGenreId(garbage)).toBeNull();
      expect(primaryGenreKey(Store.APP_STORE, garbage)).toBeNull();
      expect(primaryGenreName(Store.APP_STORE, garbage)).toBeNull();
      expect(primaryGenreKey(Store.GOOGLE_PLAY, garbage)).toBeNull();
      expect(primaryGenreName(Store.GOOGLE_PLAY, garbage)).toBeNull();
      expect(isPaid(garbage)).toBe(false);
    }
  });
});

describe('releaseNotesFor', () => {
  it('reads release notes from the store-specific field', () => {
    expect(releaseNotesFor(Store.APP_STORE, realPayload)).toBe(
      'Bug fixes and performance improvements.',
    );
    expect(
      releaseNotesFor(Store.APP_STORE, { releaseNotes: '  Whats new  ' }),
    ).toBe('Whats new');
    expect(releaseNotesFor(Store.GOOGLE_PLAY, gplayPayload)).toBe(
      'New features',
    );
    expect(
      releaseNotesFor(Store.GOOGLE_PLAY, { recentChanges: '  Updated  ' }),
    ).toBe('Updated');
  });

  it('returns null when absent, blank, or non-string', () => {
    for (const garbage of [
      null,
      undefined,
      42,
      'nope',
      {},
      { releaseNotes: '   ' },
      { releaseNotes: 123 },
    ]) {
      expect(releaseNotesFor(Store.APP_STORE, garbage)).toBeNull();
    }
    expect(
      releaseNotesFor(Store.GOOGLE_PLAY, { recentChanges: '   ' }),
    ).toBeNull();
  });
});

describe('screenshotsCount', () => {
  it('counts the screenshots array', () => {
    expect(screenshotsCount({ screenshots: ['a.png', 'b.png'] })).toBe(2);
  });

  it('returns null for missing or invalid payloads', () => {
    for (const garbage of [
      null,
      undefined,
      42,
      'nope',
      {},
      { screenshots: 3 },
    ]) {
      expect(screenshotsCount(garbage)).toBeNull();
    }
  });
});

describe('developerId', () => {
  it('stringifies the Apple artist id and falls back to developerId', () => {
    expect(developerId(Store.APP_STORE, { artistId: 284882218 })).toBe(
      '284882218',
    );
    expect(developerId(Store.APP_STORE, { developerId: 42 })).toBe('42');
    expect(developerId(Store.APP_STORE, { artistId: '284882218' })).toBe(
      '284882218',
    );
  });

  it('rejects non-numeric Apple ids that would become NaN downstream', () => {
    for (const garbage of [
      { artistId: 'Acme' },
      { developerId: 'Acme Inc' },
      { artistId: Number.NaN },
    ]) {
      expect(developerId(Store.APP_STORE, garbage)).toBeNull();
    }
  });

  it('reads the Play developer id', () => {
    expect(developerId(Store.GOOGLE_PLAY, { developerId: 'Acme Inc' })).toBe(
      'Acme Inc',
    );
  });

  it('returns null for missing or invalid payloads', () => {
    for (const store of [Store.APP_STORE, Store.GOOGLE_PLAY]) {
      for (const garbage of [
        null,
        undefined,
        'nope',
        {},
        { developerId: '' },
        { developerId: '   ' },
      ]) {
        expect(developerId(store, garbage)).toBeNull();
      }
    }
  });
});

describe('ratingHistogram', () => {
  it('parses the Play histogram with number coercion', () => {
    expect(
      ratingHistogram(Store.GOOGLE_PLAY, {
        histogram: { '1': 10, '2': '20', '3': 30, '4': 40, '5': 50 },
      }),
    ).toEqual({ '1': 10, '2': 20, '3': 30, '4': 40, '5': 50 });
  });

  it('returns null for Apple payloads', () => {
    expect(
      ratingHistogram(Store.APP_STORE, {
        histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 },
      }),
    ).toBeNull();
  });

  it('returns null for missing or incomplete histograms', () => {
    for (const garbage of [
      null,
      undefined,
      'nope',
      {},
      { histogram: null },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4 } },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 'many' } },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': '' } },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': '   ' } },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 3.7 } },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': -1 } },
      { histogram: { '1': 1, '2': 2, '3': 3, '4': 4, '5': true } },
    ]) {
      expect(ratingHistogram(Store.GOOGLE_PLAY, garbage)).toBeNull();
    }
  });
});
