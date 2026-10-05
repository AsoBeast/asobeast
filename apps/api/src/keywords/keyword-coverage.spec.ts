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
