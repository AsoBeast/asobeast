import { ChartKey, UnknownStorefrontError } from '@asobeast/shared';
import {
  assertChartKey,
  chartKeyOf,
  UnknownChartDeviceError,
  UnknownChartGenreError,
} from './chart-key';

const KEY: ChartKey = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
};

describe('chartKeyOf', () => {
  it('reads a category bucket as the default device chart of its store', () => {
    expect(
      chartKeyOf({
        store: 'GOOGLE_PLAY',
        country: 'de',
        collection: 'grossing',
        genre: 'GAME_PUZZLE',
      }),
    ).toEqual({
      store: 'GOOGLE_PLAY',
      country: 'de',
      collection: 'grossing',
      genre: 'GAME_PUZZLE',
      device: 'android',
    });
  });
});

describe('assertChartKey', () => {
  it('accepts a listed chart', () => {
    expect(() => assertChartKey(KEY)).not.toThrow();
    expect(() => assertChartKey({ ...KEY, genre: 'overall' })).not.toThrow();
  });

  it('refuses a country the store lacks', () => {
    expect(() => assertChartKey({ ...KEY, country: 'zz' })).toThrow(
      UnknownStorefrontError,
    );
  });

  it('refuses a genre the store does not chart', () => {
    expect(() => assertChartKey({ ...KEY, genre: 'GAME' })).toThrow(
      UnknownChartGenreError,
    );
    expect(() => assertChartKey({ ...KEY, genre: 'GAME' })).toThrow(
      'GAME is not an App Store chart category',
    );
  });

  it('refuses a device the store does not chart', () => {
    expect(() =>
      assertChartKey({ ...KEY, store: 'GOOGLE_PLAY', genre: 'overall' }),
    ).toThrow(UnknownChartDeviceError);
  });
});
