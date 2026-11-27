import { FUNCTION_WORDS, tokenize } from '@asobeast/shared';

const ENGLISH = new Set(
  `the an and or but is are was were be been it its this that these those
  of in on at for with from by not very too my we our you your they them
  she his her have has had does did can could would should will just than
  then there here what when why how all any`
    .split(/\s+/)
    .filter(Boolean),
);

const SHARED_WORDS: ReadonlySet<string> = new Set(
  Object.values(FUNCTION_WORDS).flatMap((words) => [...words]),
);

const ENGLISH_ONLY: ReadonlySet<string> = new Set(
  [...ENGLISH].filter((word) => !SHARED_WORDS.has(word)),
);

const LATIN_WORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  en: ENGLISH,
  ...FUNCTION_WORDS,
};

const MIN_HITS = 2;
const SCRIPT_SHARE = 0.5;

const LETTER = /\p{L}/gu;
const HAS_LETTER = /\p{L}/u;
const HANGUL = /\p{Script=Hangul}/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const UKRAINIAN = /[ґєії]/iu;

const SCRIPTS: readonly (readonly [string, RegExp])[] = [
  ['th', /\p{Script=Thai}/u],
  ['ar', /\p{Script=Arabic}/u],
  ['he', /\p{Script=Hebrew}/u],
  ['el', /\p{Script=Greek}/u],
  ['hi', /\p{Script=Devanagari}/u],
];

const SCRIPT_LANGUAGES: ReadonlySet<string> = new Set([
  'ko',
  'ja',
  'zh',
  'ru',
  'uk',
  ...SCRIPTS.map(([language]) => language),
]);

function scriptLanguage(text: string, letters: string[]): string | null {
  const share = (pattern: RegExp) =>
    letters.filter((letter) => pattern.test(letter)).length / letters.length;
  if (share(HANGUL) >= SCRIPT_SHARE) return 'ko';
  if (share(CJK) >= SCRIPT_SHARE) return share(KANA) > 0 ? 'ja' : 'zh';
  if (share(/\p{Script=Cyrillic}/u) >= SCRIPT_SHARE) {
    return UKRAINIAN.test(text) ? 'uk' : 'ru';
  }
  return (
    SCRIPTS.find(([, pattern]) => share(pattern) >= SCRIPT_SHARE)?.[0] ?? null
  );
}

interface WordMatch {
  hits: number;
  languages: string[];
}

const hitsOf = (tokens: readonly string[]): Record<string, number> =>
  Object.fromEntries(
    Object.entries(LATIN_WORDS).map(([language, words]) => [
      language,
      tokens.filter((token) => words.has(token)).length,
    ]),
  );

function bestWordMatch(text: string): WordMatch {
  const ranked = Object.entries(hitsOf(tokenize(text)))
    .map(([language, hits]) => ({ language, hits }))
    .sort((a, b) => b.hits - a.hits);
  const hits = ranked[0].hits;
  return {
    hits,
    languages:
      hits === 0
        ? []
        : ranked
            .filter((entry) => entry.hits === hits)
            .map((entry) => entry.language),
  };
}

function wordLanguage(text: string): string | null {
  const { hits, languages } = bestWordMatch(text);
  return hits >= MIN_HITS && languages.length === 1 ? languages[0] : null;
}

const lettersOf = (text: string): string[] => text.match(LETTER) ?? [];

export function textLanguage(text: string): string | null {
  const letters = lettersOf(text);
  if (letters.length === 0) return null;
  return scriptLanguage(text, letters) ?? wordLanguage(text);
}

export function textLanguages(text: string): string[] {
  const letters = lettersOf(text);
  if (letters.length === 0) return [];
  const script = scriptLanguage(text, letters);
  return script ? [script] : bestWordMatch(text).languages;
}

export interface LanguageEvidence {
  tokens: number;
  script: string | null;
  hits: Readonly<Record<string, number>>;
  englishOnly: number;
  words: number;
}

export const knowsLanguage = (language: string): boolean =>
  Object.hasOwn(LATIN_WORDS, language) || SCRIPT_LANGUAGES.has(language);

export function languageEvidence(text: string): LanguageEvidence {
  const tokens = tokenize(text);
  const letters = lettersOf(text);
  return {
    tokens: tokens.length,
    script: letters.length === 0 ? null : scriptLanguage(text, letters),
    hits: hitsOf(tokens),
    englishOnly: tokens.filter((token) => ENGLISH_ONLY.has(token)).length,
    words: tokens.filter((token) => HAS_LETTER.test(token)).length,
  };
}
