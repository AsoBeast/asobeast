import { isUnsegmented } from './scripts';

describe('isUnsegmented', () => {
  it.each([
    ['フリマアプリ', true],
    ['ふりま', true],
    ['微信', true],
    ['카카오톡', true],
    ['สั่งอาหาร', true],
    ['ສະບາຍດີ', true],
    ['សួស្តី', true],
    ['မြန်မာ', true],
    ['iphone 写真', true],
    ['habit tracker', false],
    ['яндекс карты', false],
    ['توصيل طعام', false],
    ['हिंदी मौसम', false],
    ['', false],
  ])('%s is unsegmented: %s', (text, expected) => {
    expect(isUnsegmented(text)).toBe(expected);
  });
});
