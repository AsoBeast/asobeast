import { describe, expect, it } from 'vitest';

import { InvalidStoreUrlError, parseStoreUrl } from './url-parser';

describe('parseStoreUrl — App Store URLs', () => {
  it('parses a canonical apps.apple.com URL', () => {
    expect(
      parseStoreUrl('https://apps.apple.com/us/app/anything/id1234567890'),
    ).toEqual({ store: 'APP_STORE', storeAppId: '1234567890', country: 'us' });
  });

  it('parses an itunes.apple.com URL', () => {
    expect(
      parseStoreUrl('https://itunes.apple.com/us/app/anything/id553834731'),
    ).toEqual({ store: 'APP_STORE', storeAppId: '553834731', country: 'us' });
  });

  it('lowercases an uppercase country segment', () => {
    expect(
      parseStoreUrl('https://apps.apple.com/GB/app/anything/id42'),
    ).toEqual({ store: 'APP_STORE', storeAppId: '42', country: 'gb' });
  });

  it('falls back to the default country when none is present', () => {
    expect(parseStoreUrl('https://apps.apple.com/app/anything/id42')).toEqual({
      store: 'APP_STORE',
      storeAppId: '42',
      country: 'us',
    });
  });

  it('tolerates trailing slashes and query noise', () => {
    expect(
      parseStoreUrl(
        'https://apps.apple.com/us/app/anything/id42/?mt=8&foo=bar',
      ),
    ).toEqual({ store: 'APP_STORE', storeAppId: '42', country: 'us' });
  });

  it('throws when the apple URL has no numeric id segment', () => {
    expect(() =>
      parseStoreUrl('https://apps.apple.com/us/app/anything'),
    ).toThrow(InvalidStoreUrlError);
  });
});

describe('parseStoreUrl — Google Play URLs', () => {
  it('parses a details URL', () => {
    expect(
      parseStoreUrl(
        'https://play.google.com/store/apps/details?id=com.foo.bar',
      ),
    ).toEqual({
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.foo.bar',
      country: 'us',
    });
  });

  it('reads the gl country parameter and lowercases it', () => {
    expect(
      parseStoreUrl(
        'https://play.google.com/store/apps/details?id=com.foo.bar&gl=US',
      ),
    ).toEqual({
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.foo.bar',
      country: 'us',
    });
  });

  it('throws when the id parameter is missing', () => {
    expect(() =>
      parseStoreUrl('https://play.google.com/store/apps/details?foo=bar'),
    ).toThrow(InvalidStoreUrlError);
  });
});

describe('parseStoreUrl — bare identifiers', () => {
  it('treats a bare numeric id as an App Store id', () => {
    expect(parseStoreUrl('1234567890')).toEqual({
      store: 'APP_STORE',
      storeAppId: '1234567890',
      country: 'us',
    });
  });

  it('treats a bare reverse-domain package as Google Play', () => {
    expect(parseStoreUrl('com.foo.bar')).toEqual({
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.foo.bar',
      country: 'us',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseStoreUrl('  com.foo.bar  ')).toEqual({
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.foo.bar',
      country: 'us',
    });
  });
});

describe('parseStoreUrl — invalid input', () => {
  it.each([
    '',
    '   ',
    'not a url',
    'https://example.com/foo',
    'https://apps.apple.com',
    'ftp://apps.apple.com/us/app/id42',
    'just-a-word',
  ])('throws InvalidStoreUrlError for %j', (input) => {
    expect(() => parseStoreUrl(input)).toThrow(InvalidStoreUrlError);
  });
});
