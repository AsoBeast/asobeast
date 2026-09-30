import { maxLength } from 'class-validator';
import { countMaxLengthChars } from '@asobeast/shared';

const CORPUS = [
  '',
  'habit tracker',
  '😀'.repeat(7),
  '❤\uFE0F'.repeat(7),
  '❤\uFE0E❤',
  '👨\u200D👩\u200D👧',
  '🇵🇱🇩🇪',
  'e\u0301e\u0301',
  '\uFE0F',
  'a\uFE0F\uFE0F',
  'zażółć gęślą jaźń',
  'مرحبا',
];

describe('countMaxLengthChars', () => {
  it.each(CORPUS)('agrees with class-validator for %j', (text) => {
    const used = countMaxLengthChars(text);

    expect(maxLength(text, used)).toBe(true);
    if (used > 0) {
      expect(maxLength(text, used - 1)).toBe(false);
    }
  });
});
