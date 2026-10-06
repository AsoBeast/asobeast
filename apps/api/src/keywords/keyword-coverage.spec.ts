import { coversPhrase } from '../audit/audit-scoring';
import { extractCandidates } from './extraction';
import { coversKeyword } from './keyword-coverage';

const SMARTNEWS_SUBTITLE =
  'AIが3行要約。飲食店のクーポン、雨雲レーダー、ポイントも';

describe('coversKeyword', () => {
  it('finds a spaceless keyword anywhere in the field', () => {
    const subtitle =
      'フリマアプリで簡単ショッピング 日本最大のフリマを楽しもう';
    expect(coversKeyword(subtitle, 'ショッピング')).toBe(true);
    expect(coversKeyword(subtitle, '簡単ショッピング')).toBe(true);
    expect(coversKeyword(subtitle, '日本最大')).toBe(true);
    expect(coversKeyword(subtitle, 'メルカリ')).toBe(false);
    expect(coversKeyword('สั่งอาหารและร้านอาหาร', 'ร้าน')).toBe(true);
  });

  it('finds a korean keyword only at the start of a word', () => {
    expect(coversKeyword('카카오톡 메신저를 무료로', '메신저')).toBe(true);
    expect(coversKeyword('매일 운동을 기록하세요', '운동')).toBe(true);
    expect(coversKeyword('카카오톡 - 무료 메신저', '무료 메신저')).toBe(true);
    expect(coversKeyword('편한가계부 - 지출 관리', '계부')).toBe(false);
    expect(coversKeyword('자동차 정비 기록', '차')).toBe(false);
  });

  it('finds a korean keyword as a word or before a particle, not inside a compound', () => {
    expect(coversKeyword('매일 운동을 기록하세요', '운동')).toBe(true);
    expect(coversKeyword('운동에서는 기록이 중요', '운동')).toBe(true);
    expect(coversKeyword('운동화 쇼핑몰', '운동')).toBe(false);
    expect(coversKeyword('날씨 - 일기예보 미세먼지', '일기')).toBe(false);
    expect(coversKeyword('신작 RPG 사전예약 이벤트', '사전')).toBe(false);
  });

  it('matches each word of a mixed script keyword on its own', () => {
    expect(coversKeyword('online 漫画 アプリ', 'line 漫画')).toBe(false);
    expect(coversKeyword('Ultimate 家計簿', 'mate 家計簿')).toBe(false);
    expect(coversKeyword('LINE マンガ 漫画', 'line 漫画')).toBe(true);
    expect(coversKeyword('iPhone用写真加工', 'iphone用 写真')).toBe(true);
  });

  it('matches a spaced keyword as whole words, like the audit', () => {
    const cases: Array<[string, string]> = [
      ['Habit Tracker', 'habit tracker'],
      ['Habit Tracker', 'habit'],
      ['Habits Tracker', 'habit'],
      ['Roadmap Planner', 'map'],
      ['Daily Streak: Counter', 'streak counter'],
      ['', 'habit'],
    ];
    for (const [field, keyword] of cases) {
      expect(coversKeyword(field, keyword)).toBe(coversPhrase(field, keyword));
    }
  });

  it('finds a latin word written against japanese text', () => {
    expect(coversKeyword(SMARTNEWS_SUBTITLE, 'ai')).toBe(true);
    expect(coversKeyword(SMARTNEWS_SUBTITLE, 'クーポン')).toBe(true);
    expect(coversKeyword('iPhone用カメラアプリ', 'iphone')).toBe(true);
    expect(coversKeyword('SmartNewsアプリ', 'news')).toBe(false);
  });

  it.each([
    SMARTNEWS_SUBTITLE,
    'スマートニュース｜ニュースアプリ・ポイ活・クーポン・天気',
    'iPhone用カメラアプリ',
    'Photo Editor 写真加工',
    'Yahoo!乗換案内',
    '3Dゲーム',
    'メルカリ - フリマアプリ',
    '微信 WeChat 聊天',
    '淘宝-万能的淘宝！',
    'Grab: แท็กซี่ และ แอปสั่งอาหาร',
    'Grabวันนี้',
    '카카오톡 - 무료 메신저 앱',
    'LINE マンガ 漫画',
  ])('covers every keyword extracted from %s', (field) => {
    const uncovered = extractCandidates({ title: field })
      .map((candidate) => candidate.text)
      .filter((text) => !coversKeyword(field, text));
    expect(uncovered).toEqual([]);
  });
});
