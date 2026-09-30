const PRESENTATION_SEQUENCE = /[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g;
const SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

const occurrences = (text: string, pattern: RegExp): number =>
  (text.match(pattern) ?? []).length;

export function countMaxLengthChars(text: string): number {
  return (
    text.length -
    occurrences(text, PRESENTATION_SEQUENCE) -
    occurrences(text, SURROGATE_PAIR)
  );
}
