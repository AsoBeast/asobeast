import {
  lowerCase,
  normalizeText,
  SPACELESS_CHARACTER,
  tokenize,
  withoutLinks,
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
    start = haystack.indexOf(needle, start + 1)
  ) {
    ranges.push({ start, end: start + needle.length });
  }
  return ranges;
};

const BASIC_PLANE_END = 0xffff;

const firstCharacterWidth = (text: string): number =>
  (text.codePointAt(0) ?? 0) > BASIC_PLANE_END ? 2 : 1;

const wordRanges = (text: string, words: readonly string[]): TextRange[] => {
  const pattern = new RegExp(
    `${BEFORE_WORD}${words.join(BETWEEN_WORDS)}${AFTER_WORD}`,
    "giu",
  );
  const ranges: TextRange[] = [];
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    pattern.lastIndex = match.index + firstCharacterWidth(match[0]);
  }
  return ranges;
};

export function occurrences(text: string, row: string): TextRange[] {
  const words = tokenize(row);
  if (words.length === 0) return [];
  const searched = withoutLinks(text);
  return SPACELESS_CHARACTER.test(row)
    ? spacelessRanges(searched, row.trim())
    : wordRanges(searched, words);
}

export interface MarkedPart {
  text: string;
  marked: boolean;
  start: number;
}

const merged = (ranges: readonly TextRange[]): TextRange[] =>
  ranges.reduce<TextRange[]>((runs, range) => {
    const last = runs.at(-1);
    if (last && range.start < last.end) {
      return [...runs.slice(0, -1), { start: last.start, end: range.end }];
    }
    return [...runs, range];
  }, []);

export function markedParts(text: string, row: string): MarkedPart[] {
  const parts: MarkedPart[] = [];
  let cursor = 0;
  for (const range of merged(occurrences(text, row))) {
    if (range.start > cursor) {
      parts.push({
        text: text.slice(cursor, range.start),
        marked: false,
        start: cursor,
      });
    }
    parts.push({
      text: text.slice(range.start, range.end),
      marked: true,
      start: range.start,
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), marked: false, start: cursor });
  }
  return parts;
}
