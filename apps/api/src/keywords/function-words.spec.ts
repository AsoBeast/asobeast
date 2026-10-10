import { countChars } from '@asobeast/shared';
import { FUNCTION_WORDS, functionWordTest } from './function-words';

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
  it('has a list for each of the fifteen languages the store listings are read in', () => {
    expect(Object.keys(FUNCTION_WORDS).sort()).toEqual(
      [
        'cs',
        'da',
        'de',
        'es',
        'fi',
        'fr',
        'id',
        'it',
        'nl',
        'no',
        'pl',
        'pt',
        'ro',
        'sv',
        'tr',
      ].sort(),
    );
  });

  it.each(LISTS)(
    'keeps every word of %s lower case and at least two letters',
    (_, words) => {
      expect(
        words.filter(
          (word) => word !== word.toLowerCase() || countChars(word) < 2,
        ),
      ).toEqual([]);
    },
  );

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
    ['fr', ['de', 'la', 'le', 'les', 'du', 'des', 'et', 'avec', 'sur']],
    ['de', ['der', 'die', 'das', 'den', 'und', 'mit', 'für', 'ihr', 'ist']],
    ['it', ['il', 'la', 'dei', 'del', 'di', 'per', 'con', 'che']],
    ['nl', ['de', 'het', 'een', 'van', 'voor', 'met', 'en']],
    ['sv', ['och', 'det', 'att', 'en', 'för', 'på', 'är']],
    ['no', ['og', 'det', 'dette', 'til', 'på', 'ikke']],
    ['da', ['og', 'det', 'til', 'af', 'på', 'ikke']],
    ['fi', ['ja', 'että', 'tai', 'mutta', 'ei', 'kanssa']],
    ['pl', ['dla', 'na', 'do', 'się', 'nie', 'jest', 'oraz']],
    ['tr', ['ve', 'ile', 'için', 'bir', 'bu']],
    ['id', ['yang', 'dan', 'di', 'untuk', 'dengan']],
    ['ro', ['și', 'şi', 'sau', 'pentru', 'cu']],
    ['cs', ['se', 'je', 'ale', 'nebo', 'při']],
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
});
