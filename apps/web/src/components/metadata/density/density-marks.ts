import {
  lowerCase,
  normalizeText,
  SPACELESS_CHARACTER,
  tokenize,
} from "@asobeast/shared";

export interface TextRange {
  start: number;
  end: number;
}

const BETWEEN_WORDS = String.raw`[^\p{L}\p{N}:.,|&!?;\n\r]+`;
const BEFORE_WORD = String.raw`(?<![\p{L}\p{N}])`;
const AFTER_WORD = String.raw`(?![\p{L}\p{N}])`;

const comparable = (text: string): string => {
  const normalized = normalizeText(text);
  return SPACELESS_CHARACTER.test(normalized)
    ? normalized.replaceAll(" ", "")
    : normalized;
};

export const isTrackedRow = (
  row: string,
  tracked: readonly string[],
): boolean => {
  const key = comparable(row);
  return (
    key.length > 0 && tracked.some((keyword) => comparable(keyword) === key)
  );
};

const spacelessRanges = (text: string, row: string): TextRange[] => {
  const haystack = lowerCase(text);
  const needle = lowerCase(row);
  const ranges: TextRange[] = [];
  for (
    let start = haystack.indexOf(needle);
    start !== -1;
    start = haystack.indexOf(needle, start + needle.length)
  ) {
    ranges.push({ start, end: start + needle.length });
  }
  return ranges;
};

const wordRanges = (text: string, words: readonly string[]): TextRange[] => {
  const pattern = new RegExp(
    `${BEFORE_WORD}${words.join(BETWEEN_WORDS)}${AFTER_WORD}`,
    "giu",
  );
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
};

export function occurrences(text: string, row: string): TextRange[] {
  const words = tokenize(row);
  if (words.length === 0) return [];
  return SPACELESS_CHARACTER.test(row)
    ? spacelessRanges(text, row.trim())
    : wordRanges(text, words);
}
