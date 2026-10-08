import { Store } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { OCR_LANGUAGES } from './ocr-languages';
import { ScreenshotPolicy } from './screenshot-policy';

const policy = (overrides: Partial<Env> = {}) => {
  const values = {
    SCREENSHOT_OCR: true,
    SCREENSHOT_OCR_LANGUAGES: [...OCR_LANGUAGES],
    ...overrides,
  };
  return new ScreenshotPolicy({
    get: (key: keyof typeof values) => values[key],
  } as unknown as ConfigService<Env, true>);
};

describe('ScreenshotPolicy.languagesFor', () => {
  it('reads an app store storefront with english and its own language', () => {
    expect(
      policy().languagesFor({ store: Store.APP_STORE, country: 'jp' }),
    ).toEqual(['eng', 'jpn']);
  });

  it('reads a localized listing with english and the language of its localization', () => {
    expect(
      policy().languagesFor({
        store: Store.APP_STORE,
        country: 'be',
        localization: 'fr',
      }),
    ).toEqual(['eng', 'fra']);
    expect(
      policy().languagesFor({
        store: Store.APP_STORE,
        country: 'be',
        localization: 'nl',
      }),
    ).toEqual(['eng']);
  });

  it('reads nothing on google play', () => {
    expect(
      policy().languagesFor({ store: Store.GOOGLE_PLAY, country: 'us' }),
    ).toEqual([]);
  });

  it('reads nothing when reading is switched off', () => {
    expect(
      policy({ SCREENSHOT_OCR: false }).languagesFor({
        store: Store.APP_STORE,
        country: 'us',
      }),
    ).toEqual([]);
  });

  it('honours the languages the operator enabled', () => {
    expect(
      policy({ SCREENSHOT_OCR_LANGUAGES: ['eng'] }).languagesFor({
        store: Store.APP_STORE,
        country: 'jp',
      }),
    ).toEqual(['eng']);
  });
});

describe('ScreenshotPolicy.state', () => {
  it.each([
    [Store.GOOGLE_PLAY, true, 'unsupported'],
    [Store.APP_STORE, true, 'on'],
    [Store.APP_STORE, false, 'off'],
  ])('reports %s with reading %s as %s', (store, enabled, expected) => {
    expect(policy({ SCREENSHOT_OCR: enabled }).state(store)).toBe(expected);
  });
});
