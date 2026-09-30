import * as appStore from '@perttu/app-store-scraper';

const LOOKUP_URL = 'https://itunes.apple.com/lookup?';

const PROCREATE_LOOKUP_RESULT = {
  wrapperType: 'software',
  kind: 'software',
  trackId: 425073498,
  bundleId: 'com.savage.procreate',
  trackName: 'Procreate',
  trackViewUrl: 'https://apps.apple.com/us/app/procreate/id425073498',
  description: 'Sketch, paint and illustrate.',
  artworkUrl512: 'https://example.com/icon512.png',
  genres: ['Graphics & Design', 'Productivity'],
  genreIds: ['6027', '6007'],
  primaryGenreName: 'Graphics & Design',
  primaryGenreId: 6027,
  contentAdvisoryRating: '4+',
  languageCodesISO2A: ['EN', 'JA'],
  releaseNotes: 'Bug fixes.',
  version: '5.3.9',
  price: 0,
  currency: 'USD',
  artistId: 425073501,
  artistName: 'Savage Interactive',
  averageUserRating: 4.7,
  userRatingCount: 12000,
  screenshotUrls: ['https://example.com/s1.png'],
  ipadScreenshotUrls: ['https://example.com/i1.png'],
  supportedDevices: ['iPhone13-iPhone13', 'iPadAir-iPadAir'],
};

const LOOKUP_BODY = JSON.stringify({
  resultCount: 1,
  results: [PROCREATE_LOOKUP_RESULT],
});

export async function scrapedAppStoreRaw(): Promise<Record<string, unknown>> {
  const requested: string[] = [];
  const app = await appStore.app({
    id: PROCREATE_LOOKUP_RESULT.trackId,
    country: 'us',
    requestOptions: {
      fetch: (input) => {
        requested.push(input instanceof Request ? input.url : input.toString());
        return Promise.resolve(new Response(LOOKUP_BODY, { status: 200 }));
      },
    },
  });
  if (requested.length !== 1 || !requested[0].startsWith(LOOKUP_URL)) {
    throw new Error(
      `expected one stubbed lookup, the scraper requested [${requested.join(', ')}]`,
    );
  }
  return JSON.parse(JSON.stringify(app)) as Record<string, unknown>;
}
