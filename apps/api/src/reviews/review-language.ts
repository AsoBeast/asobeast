import { tokenize } from '@asobeast/shared';
import { FUNCTION_WORDS } from '../keywords/function-words';

const ENGLISH = new Set(
  `the an and or but is are was were be been it its this that these those
  of in on at for with from by not very too my we our you your they them
  she his her have has had does did can could would should will just than
  then there here what when why how all any`
    .split(/\s+/)
    .filter(Boolean),
);

const LATIN_WORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  en: ENGLISH,
  ...FUNCTION_WORDS,
};

const MIN_HITS = 2;
const SCRIPT_SHARE = 0.5;

const LETTER = /\p{L}/gu;
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

function bestWordMatch(text: string): WordMatch {
  const tokens = tokenize(text);
  const ranked = Object.entries(LATIN_WORDS)
    .map(([language, words]) => ({
      language,
      hits: tokens.filter((token) => words.has(token)).length,
    }))
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

export function reviewLanguage(text: string): string | null {
  const letters = lettersOf(text);
  if (letters.length === 0) return null;
  return scriptLanguage(text, letters) ?? wordLanguage(text);
}

export function reviewLanguages(text: string): string[] {
  const letters = lettersOf(text);
  if (letters.length === 0) return [];
  const script = scriptLanguage(text, letters);
  return script ? [script] : bestWordMatch(text).languages;
}
