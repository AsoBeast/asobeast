const UNSEGMENTED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

export const isUnsegmented = (text: string): boolean => UNSEGMENTED.test(text);
