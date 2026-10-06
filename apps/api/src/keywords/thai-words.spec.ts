import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attachThaiPrefixes, STORE_WORDS, thaiSpans } from './thai-words';

const PYTHAINLP_WORDS_SHA256 =
  '35f65d43ea83b5b981134d5edc3b9afcb64b4ba96146900fc4d312f2940c3265';

const wordList = readFileSync(join(__dirname, 'thai-words.txt'), 'utf8');

const CLUSTER_CONTINUATION = /[ะ-ฺๅ-๎]/u;
const LEADING_VOWEL = /[เ-ไ]/u;

const RUNS = [
  'เดินทางด้วยความอุ่นใจ',
  'จองการเดินทางไปสนามบินล่วงหน้ากับ',
  'แอปสั่งอาหาร',
  'ช้อปปิ้งออนไลน์ส่วนลดทุกวัน',
  'ตรวจผลสลากกินแบ่งรัฐบาลงวดล่าสุด',
  'ทรูมันนี่วอลเล็ท',
  'เคพลัส',
  'ดูดวงรายวันแม่นๆ',
];

describe('thaiSpans', () => {
  it('splits a run at the words of the dictionary', () => {
    expect(thaiSpans('สนามบินล่วงหน้า')).toEqual([
      { text: 'สนามบิน', index: 0, known: true },
      { text: 'ล่วงหน้า', index: 7, known: true },
    ]);
  });

  it('leaves text the dictionary does not know as one unknown span', () => {
    expect(thaiSpans('เคพลัส')).toEqual([
      { text: 'เค', index: 0, known: true },
      { text: 'พลัส', index: 2, known: false },
    ]);
  });

  it.each(RUNS)('covers %s with adjacent spans in order', (run) => {
    const spans = thaiSpans(run);
    expect(spans.map((span) => span.text).join('')).toBe(run);
    spans.forEach((span) => {
      expect(run.slice(span.index, span.index + span.text.length)).toBe(
        span.text,
      );
    });
  });

  it.each(RUNS)('never starts a word of %s inside a cluster', (run) => {
    for (const span of thaiSpans(run).filter((each) => each.known)) {
      expect(CLUSTER_CONTINUATION.test(span.text.charAt(0))).toBe(false);
      expect(LEADING_VOWEL.test(run.charAt(span.index - 1))).toBe(false);
      expect(LEADING_VOWEL.test(span.text.at(-1) ?? '')).toBe(false);
    }
  });

  it('keeps the repeat mark with the word before it', () => {
    expect(thaiSpans('แม่นๆ')).toEqual([
      { text: 'แม่นๆ', index: 0, known: true },
    ]);
  });

  it('splits a dictionary entry made only of function words', () => {
    expect(thaiSpans('ไม่ต้องใช้').map((span) => span.text)).toEqual([
      'ไม่',
      'ต้อง',
      'ใช้',
    ]);
  });

  it('knows the store words the dictionary lacks', () => {
    expect(thaiSpans('แอปช้อปสกินแคร์').map((span) => span.text)).toEqual([
      'แอป',
      'ช้อป',
      'สกินแคร์',
    ]);
  });

  it.each(['', 'ๆ', 'ๆๆ', 'ั', 'เ', 'ัก'])(
    'does not fail on the run %j',
    (run) => {
      expect(
        thaiSpans(run)
          .map((span) => span.text)
          .join(''),
      ).toBe(run);
    },
  );
});

describe('the thai word list', () => {
  it('is the pinned pythainlp word list', () => {
    expect(createHash('sha256').update(wordList).digest('hex')).toBe(
      PYTHAINLP_WORDS_SHA256,
    );
  });

  it('adds only store words the list lacks', () => {
    const listed = new Set(wordList.split('\n'));
    expect(STORE_WORDS.filter((word) => listed.has(word))).toEqual([]);
  });
});

describe('attachThaiPrefixes', () => {
  it.each([
    [['การ', 'เดินทาง'], ['การเดินทาง']],
    [
      ['ความ', 'สวย', 'ความ', 'งาม'],
      ['ความสวย', 'ความงาม'],
    ],
    [
      ['ผู้', 'ให้', 'บริการ'],
      ['ผู้', 'ให้', 'บริการ'],
    ],
    [['การ'], ['การ']],
    [
      ['การ', 'grab'],
      ['การ', 'grab'],
    ],
    [
      ['การ', 'ความ', 'สุข'],
      ['การ', 'ความสุข'],
    ],
  ])('joins %j into %j', (words, expected) => {
    expect(attachThaiPrefixes(words)).toEqual(expected);
  });
});
