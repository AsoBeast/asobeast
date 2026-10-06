import { containsTerm, isUnsegmented } from './scripts';

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

describe('containsTerm', () => {
  it.each([
    ['フリマアプリで簡単ショッピング', 'ショッピング', true],
    ['카카오톡 메신저를', '메신저', true],
    ['편한가계부 지출', '계부', false],
    ['운동화 쇼핑몰', '운동', false],
    ['운동에서는 기록', '운동', true],
    ['habit tracker', 'habit', true],
    ['roadmap planner', 'map', false],
  ])('%s contains %s: %s', (text, term, expected) => {
    expect(containsTerm(text, term)).toBe(expected);
  });
});
