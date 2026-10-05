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

export const isUnsegmented = (text: string): boolean =>
  SPACELESS_CHARACTER.test(text) || HANGUL_CHARACTER.test(text);

export const containsTerm = (text: string, term: string): boolean => {
  if (SPACELESS_CHARACTER.test(term)) {
    return text.includes(term);
  }
  return HANGUL_CHARACTER.test(term)
    ? ` ${text}`.includes(` ${term}`)
    : ` ${text} `.includes(` ${term} `);
};
