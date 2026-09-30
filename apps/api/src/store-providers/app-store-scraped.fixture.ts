import * as appStore from '@perttu/app-store-scraper';

const PROCREATE_LOOKUP_RESULT = {
  wrapperType: 'software',
  kind: 'software',
  trackId: 425073498,
  bundleId: 'com.savage.procreate',
  trackName: 'Procreate Pocket',
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

export async function scrapedAppStoreRaw(
  lookupOverrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const body = JSON.stringify({
    resultCount: 1,
    results: [{ ...PROCREATE_LOOKUP_RESULT, ...lookupOverrides }],
  });
  const app = await appStore.app({
    id: 425073498,
    country: 'us',
    requestOptions: {
      fetch: () => Promise.resolve(new Response(body, { status: 200 })),
    },
  });
  return { ...app };
}
