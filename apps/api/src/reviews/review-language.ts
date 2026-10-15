import { tokenize } from '@asobeast/shared';
import { FUNCTION_WORDS } from '../keywords/function-words';

const ENGLISH = new Set(
  `the a an and or but is are was were be been it its this that these those
  to of in on at for with from by not no very so too i my me we our you your
  they them he she his her have has had do does did can could would should
  will just than then there here what when why how all any`
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

function wordLanguage(text: string): string | null {
  const tokens = tokenize(text);
  const ranked = Object.entries(LATIN_WORDS)
    .map(([language, words]) => ({
      language,
      hits: tokens.filter((token) => words.has(token)).length,
    }))
    .sort((a, b) => b.hits - a.hits);
  const [best, runnerUp] = ranked;
  return best.hits >= MIN_HITS && best.hits > runnerUp.hits
    ? best.language
    : null;
}

export function reviewLanguage(text: string): string | null {
  const letters = text.match(LETTER) ?? [];
  if (letters.length === 0) return null;
  return scriptLanguage(text, letters) ?? wordLanguage(text);
}
