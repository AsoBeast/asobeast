import { describe, expect, it } from 'vitest';

import { normalizeText, tokenize } from '../text';
import { countChars } from './limits';
import {
  ARABIC_DECORATION,
  ARABIC_FUNCTION_WORDS,
  CHINESE_FUNCTION_WORDS,
  CHINESE_PARTICLES,
  FUNCTION_WORDS,
  functionWordTest,
  REVIEW_ONLY_FUNCTION_WORDS,
  reviewWordTest,
  THAI_FUNCTION_WORDS,
} from './function-words';

const LISTS = Object.entries(FUNCTION_WORDS).map(
  ([language, words]) => [language, [...words]] as const,
);

const LEFT_TO_THE_LISTING: Readonly<Record<string, readonly string[]>> = {
  es: ['uno', 'contra', 'mi', 'mis', 'poco', 'todo', 'dos', 'sol', 'go'],
  pt: ['contra', 'pro', 'meu', 'minha', 'plus', 'go'],
  fr: ['mon', 'ma', 'mes', 'sans', 'plus', 'été', 'go'],
  de: ['mein', 'man', 'war', 'hat', 'go'],
  it: ['uno', 'io', 'mi', 'vi', 'pro', 'go'],
  nl: ['mijn', 'ben', 'nu', 'go'],
  sv: ['min', 'man', 'ur', 'go'],
  no: ['min', 'inn', 'alt', 'go'],
  da: ['min', 'os', 'alt', 'dog', 'end', 'go'],
  fi: ['go'],
  pl: ['mój', 'pod', 'one', 'go', 'pro'],
  tr: ['mi', 'ben', 'go'],
  id: ['ada', 'saya', 'go'],
  ro: ['tu', 'meu', 'go'],
  cs: ['pro', 'ten', 'go'],
  ru: ['мой', 'моя', 'мое', 'моё', 'мои', 'про', 'есть', 'go'],
  uk: ['мій', 'про', 'go'],
  ko: [
    '우리',
    '모두',
    '여기',
    '가장',
    '무료',
    '다시',
    '함께',
    '관련',
    '이상',
    '이하',
    '경우',
    '정도',
    '항상',
    '모든',
    'go',
  ],
  ar: ['تطبيق', 'مجاني', 'أفضل', 'جديد', 'تحميل', 'رسمي', 'go'],
  zh: ['免费', '应用', '官方', 'go'],
  th: ['แอป', 'ฟรี', 'วันนี้', 'go'],
  ja: ['アプリ', '無料', '公式', 'ダウンロード', 'go'],
};

const NEVER_A_FUNCTION_WORD: readonly string[] = [
  'agar',
  'care',
  'dig',
  'elle',
  'era',
  'ham',
  'ho',
  'io',
  'men',
  'mod',
  'nyt',
  'sea',
  'ten',
  'uno',
];

describe('FUNCTION_WORDS', () => {
  it('has a list for each language the store listings are read in', () => {
    expect(Object.keys(FUNCTION_WORDS).sort()).toEqual(
      [
        'ar',
        'cs',
        'da',
        'de',
        'es',
        'fi',
        'fr',
        'id',
        'it',
        'ja',
        'ko',
        'nl',
        'no',
        'pl',
        'pt',
        'ro',
        'ru',
        'sv',
        'th',
        'tr',
        'uk',
        'zh',
      ].sort(),
    );
  });

  it.each([
    ['ru', 159],
    ['uk', 145],
    ['ko', 59],
    ['ar', 111],
    ['zh', 36],
    ['th', 35],
    ['ja', 37],
  ])('holds the words of %s once each', (language, size) => {
    expect(FUNCTION_WORDS[language].size).toBe(size);
  });

  it.each(LISTS)(
    'keeps every word of %s lower case and at least two letters',
    (_, words) => {
      expect(
        words.filter(
          (word) =>
            word !== word.toLowerCase() ||
            (countChars(word) < 2 && !CHINESE_PARTICLES.has(word)),
        ),
      ).toEqual([]);
    },
  );

  it.each(LISTS)('keeps every word of %s one normalized token', (_, words) => {
    expect(
      words.filter(
        (word) => word !== normalizeText(word) || tokenize(word).length !== 1,
      ),
    ).toEqual([]);
  });

  it.each(LISTS)('keeps the tatweel and the harakat out of %s', (_, words) => {
    expect(
      words.filter((word) => word.replace(ARABIC_DECORATION, '') !== word),
    ).toEqual([]);
  });

  it.each(LISTS)(
    'leaves the names that spell a function word to the listing in %s',
    (language, words) => {
      expect(
        words.filter((word) => LEFT_TO_THE_LISTING[language].includes(word)),
      ).toEqual([]);
    },
  );

  it.each(LISTS)(
    'leaves the english words and brands every storefront searches out of %s',
    (_, words) => {
      expect(
        words.filter((word) => NEVER_A_FUNCTION_WORD.includes(word)),
      ).toEqual([]);
    },
  );
});

describe('functionWordTest', () => {
  it.each([
    [
      'es',
      ['de', 'la', 'el', 'en', 'los', 'las', 'del', 'para', 'tu', 'tus', 'te'],
    ],
    ['pt', ['de', 'em', 'um', 'uma', 'com', 'para', 'pra', 'os']],
    [
      'fr',
      [
        'de',
        'la',
        'le',
        'les',
        'du',
        'des',
        'et',
        'avec',
        'sur',
        'depuis',
        'avant',
        'suis',
      ],
    ],
    ['de', ['der', 'die', 'das', 'den', 'und', 'mit', 'für', 'ihr', 'ist']],
    ['it', ['il', 'la', 'dei', 'del', 'di', 'per', 'con', 'che']],
    ['nl', ['de', 'het', 'een', 'van', 'voor', 'met', 'en']],
    ['sv', ['och', 'det', 'att', 'en', 'för', 'på', 'är']],
    ['no', ['og', 'det', 'dette', 'til', 'på', 'ikke']],
    ['da', ['og', 'det', 'til', 'af', 'på', 'ikke']],
    ['fi', ['ja', 'että', 'tai', 'mutta', 'ei', 'kanssa']],
    [
      'pl',
      [
        'dla',
        'na',
        'do',
        'się',
        'nie',
        'jest',
        'oraz',
        'coś',
        'zamiast',
        'zawsze',
      ],
    ],
    ['tr', ['ve', 'ile', 'için', 'bir', 'bu']],
    ['id', ['yang', 'dan', 'di', 'untuk', 'dengan']],
    ['ro', ['și', 'şi', 'sau', 'pentru', 'cu']],
    ['cs', ['se', 'je', 'ale', 'nebo', 'při']],
    ['ru', ['не', 'что', 'на', 'для', 'это', 'при', 'без', 'свой']],
    ['uk', ['та', 'але', 'що', 'для', 'не', 'щоб']],
    ['ko', ['그리고', '하지만', '합니다', '위한', '입니다']],
    ['ar', ['في', 'من', 'على', 'أكثر', 'هذان', 'حول', 'لكن']],
    ['zh', ['我们', '一个', '的', '我']],
    ['th', ['ที่', 'และ', 'ไม่']],
    ['ja', ['です', 'ます', 'から', 'この', 'ない']],
  ])('knows the function words of %s', (language, words) => {
    const isFunctionWord = functionWordTest([language]);

    expect(words.filter((word) => !isFunctionWord(word))).toEqual([]);
  });

  it('knows nothing without a language', () => {
    expect(functionWordTest([])('de')).toBe(false);
  });

  it('knows nothing of a language it has no list for', () => {
    expect(functionWordTest(['xx', 'toString'])('de')).toBe(false);
  });

  it('reads the lists of every language it is given', () => {
    const isFunctionWord = functionWordTest(['de', 'fr', 'it']);

    expect(
      ['für', 'avec', 'dei'].filter((word) => !isFunctionWord(word)),
    ).toEqual([]);
  });

  it('does not read a language that was not asked for', () => {
    expect(functionWordTest(['es'])('der')).toBe(false);
    expect(functionWordTest(['de'])('el')).toBe(false);
  });

  it('reads an arabic word written with tatweel or harakat as the bare word', () => {
    const isFunctionWord = functionWordTest(['ar']);

    expect(
      ['أكـثر', 'أَكْثَر', 'فِي'].filter((word) => !isFunctionWord(word)),
    ).toEqual([]);
    expect(isFunctionWord('طَعَام')).toBe(false);
  });

  it('reads an arabic function word joined to the conjunction as the word', () => {
    const isFunctionWord = functionWordTest(['ar']);

    expect(
      ['وحول', 'وفي', 'وَحَول'].filter((word) => !isFunctionWord(word)),
    ).toEqual([]);
    expect(isFunctionWord('وطعام')).toBe(false);
    expect(isFunctionWord('و')).toBe(false);
    expect(functionWordTest(['fr'])('وفي')).toBe(false);
  });

  it('keeps the russian and the ukrainian lists apart', () => {
    expect(functionWordTest(['ru'])('что')).toBe(true);
    expect(functionWordTest(['ru'])('чи')).toBe(false);
    expect(functionWordTest(['uk'])('чи')).toBe(true);
    expect(functionWordTest(['uk'])('что')).toBe(false);
  });
});

const REVIEW_LISTS = Object.entries(REVIEW_ONLY_FUNCTION_WORDS).map(
  ([language, words]) => [language, [...words]] as const,
);

describe('REVIEW_ONLY_FUNCTION_WORDS', () => {
  it('has a list for the languages whose listings keep a function word', () => {
    expect(Object.keys(REVIEW_ONLY_FUNCTION_WORDS).sort()).toEqual([
      'de',
      'fr',
    ]);
  });

  it.each(REVIEW_LISTS)(
    'keeps every word of %s lower case and at least two letters',
    (_language, words) => {
      expect(
        words.filter(
          (word) => word !== word.toLowerCase() || countChars(word) < 2,
        ),
      ).toEqual([]);
    },
  );

  it.each(REVIEW_LISTS)(
    'repeats no word of the shared list of %s',
    (language, words) => {
      expect(
        words.filter((word) => FUNCTION_WORDS[language].has(word)),
      ).toEqual([]);
    },
  );

  it('holds the words the listings of French and German leave to themselves', () => {
    expect([...REVIEW_ONLY_FUNCTION_WORDS.fr].sort()).toEqual([
      'ma',
      'mes',
      'mon',
      'sans',
    ]);
    expect([...REVIEW_ONLY_FUNCTION_WORDS.de].sort()).toEqual(['hat', 'war']);
  });
});

describe('reviewWordTest', () => {
  it('knows the shared list and the review only list of a language', () => {
    const french = reviewWordTest(['fr']);
    const german = reviewWordTest(['de']);

    expect(
      ['de', 'mes', 'mon', 'ma', 'sans', 'depuis'].filter(
        (word) => !french(word),
      ),
    ).toEqual([]);
    expect(['der', 'hat', 'war'].filter((word) => !german(word))).toEqual([]);
  });

  it('leaves the listing test alone', () => {
    expect(functionWordTest(['fr'])('mes')).toBe(false);
    expect(functionWordTest(['de'])('war')).toBe(false);
  });

  it('does not read a language that was not asked for', () => {
    expect(reviewWordTest([])('war')).toBe(false);
    expect(reviewWordTest(['es'])('mes')).toBe(false);
    expect(reviewWordTest(['de'])('mes')).toBe(false);
    expect(reviewWordTest(['xx', 'toString'])('war')).toBe(false);
  });

  it('leaves the words the issue scopes out', () => {
    const french = reviewWordTest(['fr']);
    const polish = reviewWordTest(['pl']);
    const german = reviewWordTest(['de']);

    expect(
      [
        'elle',
        'plus',
        'fait',
        'bien',
        'donc',
        'alors',
        'quand',
        'était',
        'fais',
        'faire',
        'utile',
      ].filter(french),
    ).toEqual([]);
    expect(['chce', 'wiem'].filter(polish)).toEqual([]);
    expect(['got', 'one'].filter(german)).toEqual([]);
  });
});

const SCRIPT_LISTS = [
  ['the chinese function words', CHINESE_FUNCTION_WORDS, 8],
  ['the chinese particles', CHINESE_PARTICLES, 28],
  ['the thai function words', THAI_FUNCTION_WORDS, 35],
  ['the arabic function words', ARABIC_FUNCTION_WORDS, 31],
] as const;

describe('the script function words', () => {
  it.each(SCRIPT_LISTS)('keeps %s as they were', (_, list, size) => {
    expect(list.size).toBe(size);
  });

  it('holds the function words and not the store words of keyword extraction', () => {
    expect(ARABIC_FUNCTION_WORDS.has('كل')).toBe(true);
    expect(ARABIC_FUNCTION_WORDS.has('تطبيق')).toBe(false);
    expect(THAI_FUNCTION_WORDS.has('และ')).toBe(true);
    expect(THAI_FUNCTION_WORDS.has('แอป')).toBe(false);
    expect(CHINESE_FUNCTION_WORDS.has('我们')).toBe(true);
    expect(CHINESE_FUNCTION_WORDS.has('免费')).toBe(false);
  });

  it('strips the tatweel and the harakat of an arabic word', () => {
    expect('أكـثر'.replace(ARABIC_DECORATION, '')).toBe('أكثر');
    expect('أَكْثَر'.replace(ARABIC_DECORATION, '')).toBe('أكثر');
    expect('طعام'.replace(ARABIC_DECORATION, '')).toBe('طعام');
  });
});
