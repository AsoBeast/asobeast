const WIDE_SCRIPTS = String.raw`\p{Script=Han}\p{scx=Hiragana}\p{scx=Katakana}`;
const SPACELESS_SCRIPTS = String.raw`${WIDE_SCRIPTS}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}`;

export const WIDE_CHARACTER = new RegExp(`[${WIDE_SCRIPTS}]`, 'u');
export const SPACELESS_CHARACTER = new RegExp(`[${SPACELESS_SCRIPTS}]`, 'u');
export const SPACELESS_OR_NOT = new RegExp(
  `[${SPACELESS_SCRIPTS}]+|[^${SPACELESS_SCRIPTS}]+`,
  'gu',
);
const HANGUL_CHARACTER = /\p{Script=Hangul}/u;
export const KANA_CHARACTER = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
export const THAI_CHARACTER = /\p{Script=Thai}/u;

export const isUnsegmented = (text: string): boolean =>
  SPACELESS_CHARACTER.test(text) || HANGUL_CHARACTER.test(text);

const KOREAN_PARTICLES: ReadonlySet<string> = new Set([
  '을',
  '를',
  '이',
  '가',
  '은',
  '는',
  '의',
  '에',
  '에서',
  '에게',
  '도',
  '로',
  '으로',
  '와',
  '과',
  '만',
  '까지',
  '부터',
  '처럼',
  '보다',
  '랑',
  '이랑',
  '하고',
  '이나',
  '나',
  '에는',
  '에도',
  '에서는',
  '에서도',
  '으로는',
  '로는',
]);

const isKoreanForm = (word: string, term: string): boolean =>
  word.startsWith(term) && KOREAN_PARTICLES.has(word.slice(term.length));

export const containsTerm = (text: string, term: string): boolean => {
  if (SPACELESS_CHARACTER.test(term)) {
    return text.includes(term);
  }
  if (` ${text} `.includes(` ${term} `)) {
    return true;
  }
  return (
    HANGUL_CHARACTER.test(term) &&
    text.split(' ').some((word) => isKoreanForm(word, term))
  );
};
