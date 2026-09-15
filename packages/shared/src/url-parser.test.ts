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

describe('parseStoreUrl — canonical App Store ids', () => {
  it.each([
    ['0570060128', '570060128'],
    ['https://apps.apple.com/us/app/duolingo/id0570060128', '570060128'],
    ['https://apps.apple.com/us/app/anything/id000042', '42'],
    ['9007199254740991', '9007199254740991'],
  ])('resolves %j to the listing id %j', (input, storeAppId) => {
    expect(parseStoreUrl(input)).toEqual({
      store: 'APP_STORE',
      storeAppId,
      country: 'us',
    });
  });

  it.each([
    '0',
    '0000',
    'https://apps.apple.com/us/app/anything/id0000',
    '9007199254740992',
    '99999999999999999999',
  ])('refuses %j, which names no listing asobeast can represent', (input) => {
    expect(() => parseStoreUrl(input)).toThrow(InvalidStoreUrlError);
  });
});

describe('parseStoreUrl — a store url pasted without a scheme', () => {
  it('parses an App Store listing typed the way the import dialog shows it', () => {
    expect(parseStoreUrl('apps.apple.com/us/app/anything/id42')).toEqual({
      store: 'APP_STORE',
      storeAppId: '42',
      country: 'us',
    });
  });

  it('parses an itunes.apple.com listing without a country', () => {
    expect(parseStoreUrl('itunes.apple.com/app/id42')).toEqual({
      store: 'APP_STORE',
      storeAppId: '42',
      country: 'us',
    });
  });

  it('parses a Google Play details url with its country', () => {
    expect(
      parseStoreUrl('play.google.com/store/apps/details?id=com.foo.bar&gl=DE'),
    ).toEqual({
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.foo.bar',
      country: 'de',
    });
  });

  it('keeps a legacy itunes listing url with its media type', () => {
    expect(parseStoreUrl('https://itunes.apple.com/us/app/id42?mt=8')).toEqual({
      store: 'APP_STORE',
      storeAppId: '42',
      country: 'us',
    });
  });

  it('echoes the input as it was typed when it refuses it', () => {
    expect(() => parseStoreUrl('apps.apple.com/us/app/anything')).toThrow(
      'Unrecognized store URL or id: apps.apple.com/us/app/anything',
    );
  });
});

describe('parseStoreUrl — an Apple page that is not a listing', () => {
  it.each([
    'https://apps.apple.com/us/developer/anything/id42',
    'https://itunes.apple.com/us/album/anything/id42',
    'https://apps.apple.com/us/app-bundle/anything/id42',
    'https://apps.apple.com/us/story/id42',
    'example.com/app/id42',
  ])('refuses %j', (input) => {
    expect(() => parseStoreUrl(input)).toThrow(InvalidStoreUrlError);
  });
});

describe('parseStoreUrl — the storefront a url names', () => {
  it.each([
    'https://apps.apple.com/xx/app/anything/id42',
    'https://play.google.com/store/apps/details?id=com.foo.bar&gl=usa',
    'https://play.google.com/store/apps/details?id=com.foo.bar&gl=zz',
    'https://play.google.com/store/apps/details?id=com.foo.bar&gl=pw',
  ])('refuses %j, which names no storefront of its store', (input) => {
    expect(() => parseStoreUrl(input)).toThrow();
  });

  it('keeps an App Store storefront Google Play does not have', () => {
    expect(
      parseStoreUrl('https://apps.apple.com/pw/app/anything/id42'),
    ).toEqual({ store: 'APP_STORE', storeAppId: '42', country: 'pw' });
  });

  it('keeps a Google Play location the App Store does not have', () => {
    expect(
      parseStoreUrl(
        'https://play.google.com/store/apps/details?id=com.foo.bar&gl=AD',
      ),
    ).toEqual({
      store: 'GOOGLE_PLAY',
      storeAppId: 'com.foo.bar',
      country: 'ad',
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
