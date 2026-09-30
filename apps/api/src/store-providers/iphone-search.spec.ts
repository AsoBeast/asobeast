import { Store } from '@prisma/client';
import { listedInIphoneSearch, rawListedInIphoneSearch } from './iphone-search';

describe('listedInIphoneSearch', () => {
  it.each([
    [['iPhone15-iPhone15', 'iPadAir5-iPadAir5'], true],
    [['iPodTouchSeventhGen-iPodTouchSeventhGen'], true],
    [['iPadAir-iPadAir', 'iPadPro13M4-iPadPro13M4'], false],
    [['iPadPro13M4-iPadPro13M4', 'MacDesktop-MacDesktop'], false],
    [[], false],
    [undefined, true],
  ])('reads %j as %s', (devices, expected) => {
    expect(listedInIphoneSearch(devices)).toBe(expected);
  });
});

describe('rawListedInIphoneSearch', () => {
  const ipadOnly = { supportedDevices: ['iPadAir-iPadAir'] };

  it('reads the devices a snapshot stored', () => {
    expect(rawListedInIphoneSearch(Store.APP_STORE, ipadOnly)).toBe(false);
  });

  it.each([
    ['a snapshot without the field', { source: 'fixture' }],
    ['a field that is not a list', { supportedDevices: 'iPad' }],
    ['a raw payload that is not an object', 'nothing'],
    ['no raw payload', null],
  ])('treats %s as unknown and searchable', (_, raw) => {
    expect(rawListedInIphoneSearch(Store.APP_STORE, raw)).toBe(true);
  });

  it('ignores entries that are not strings', () => {
    expect(
      rawListedInIphoneSearch(Store.APP_STORE, {
        supportedDevices: [1, null, 'iPhone15-iPhone15'],
      }),
    ).toBe(true);
  });

  it('never applies to Google Play', () => {
    expect(rawListedInIphoneSearch(Store.GOOGLE_PLAY, ipadOnly)).toBe(true);
  });
});
