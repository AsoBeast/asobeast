import { coversPhrase } from '../audit/audit-scoring';
import { coversKeyword } from './keyword-coverage';

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
});
