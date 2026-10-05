const UNSEGMENTED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

export const isUnsegmented = (text: string): boolean => UNSEGMENTED.test(text);
