import { listingSegments } from '../listing-segments';
import { ENGLISH_FUNCTION_WORDS, lowerCase, tokenize } from '../text';
import { SPACELESS_CHARACTER, SPACELESS_OR_NOT } from '../text-scripts';
import { functionWordTest, type TokenTest } from './function-words';
import { countChars } from './limits';

export const DENSITY_ROW_LIMIT = 20;
export const DENSITY_MIN_REPEAT = 2;
export const DENSITY_MIN_TOKEN_CHARS = 2;

export interface DensityRow {
  text: string;
  count: number;
  share: number;
}

export interface WordDensity {
  words: number;
  single: DensityRow[];
  pairs: DensityRow[] | null;
  triples: DensityRow[] | null;
}

export interface WordDensityOptions {
  language: string | null;
  ignored?: readonly string[];
}

interface DensityToken {
  text: string;
  spaceless: boolean;
}

const LINK = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/giu;
const SENTENCE_BREAK = /[!?;\n\r]/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const NUMBER = /^\p{N}+$/u;
const ENGLISH = 'en';

const segmenters = new Map<string, Intl.Segmenter>();

const segmenterFor = (language: string | null): Intl.Segmenter => {
  const key = language ?? '';
  const cached = segmenters.get(key);
  if (cached) return cached;
  const segmenter = new Intl.Segmenter(language ?? undefined, {
    granularity: 'word',
  });
  segmenters.set(key, segmenter);
  return segmenter;
};

const withoutLinks = (text: string): string => text.replace(LINK, ' ');

const runsOf = (text: string): string[] => text.match(SPACELESS_OR_NOT) ?? [];

const segmentWords = (run: string, language: string | null): string[] =>
  [...segmenterFor(language).segment(run)]
    .filter((segment) => segment.isWordLike)
    .map((segment) => lowerCase(segment.segment));

const wordsInChunk = (chunk: string): number =>
  SPACELESS_CHARACTER.test(chunk)
    ? runsOf(chunk).reduce(
        (sum, run) =>
          sum +
          (SPACELESS_CHARACTER.test(run)
            ? segmentWords(run, null).length
            : Number(WORD_CHARACTER.test(run))),
        0,
      )
    : 1;

export function countWords(text: string): number {
  return withoutLinks(text)
    .split(/\s+/u)
    .filter((chunk) => WORD_CHARACTER.test(chunk))
    .reduce((sum, chunk) => sum + wordsInChunk(chunk), 0);
}

const tokensOf = (segment: string, language: string | null): DensityToken[] =>
  runsOf(segment).flatMap((run) =>
    SPACELESS_CHARACTER.test(run)
      ? segmentWords(run, language).map((text) => ({ text, spaceless: true }))
      : tokenize(run).map((text) => ({ text, spaceless: false })),
  );

const densitySegments = (
  text: string,
  language: string | null,
): DensityToken[][] =>
  listingSegments(withoutLinks(text))
    .flatMap((segment) => segment.split(SENTENCE_BREAK))
    .map((segment) => tokensOf(segment, language))
    .filter((tokens) => tokens.length > 0);

const keptTest = ({
  language,
  ignored = [],
}: WordDensityOptions): TokenTest => {
  const isFunctionWord = functionWordTest(language === null ? [] : [language]);
  const ignoredWords = new Set(
    densitySegments(ignored.join('\n'), language)
      .flat()
      .map((token) => token.text),
  );
  return (token) =>
    !isFunctionWord(token) &&
    !(language === ENGLISH && ENGLISH_FUNCTION_WORDS.has(token)) &&
    !ignoredWords.has(token) &&
    !NUMBER.test(token) &&
    countChars(token) >= DENSITY_MIN_TOKEN_CHARS;
};

const tally = (texts: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
  return counts;
};

const ranked = (
  counts: ReadonlyMap<string, number>,
  words: number,
  size: number,
): DensityRow[] =>
  [...counts]
    .map(([text, count]) => ({
      text,
      count,
      share: words === 0 ? 0 : (count * size) / words,
    }))
    .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1))
    .slice(0, DENSITY_ROW_LIMIT);

const joined = (tokens: readonly DensityToken[]): string =>
  tokens
    .map((token) => token.text)
    .join(tokens.every((token) => token.spaceless) ? '' : ' ');

const phrases = (
  segments: readonly DensityToken[][],
  size: number,
  keep: TokenTest,
): Map<string, number> => {
  const found = segments.flatMap((tokens) =>
    tokens
      .slice(0, Math.max(0, tokens.length - size + 1))
      .map((_, start) => tokens.slice(start, start + size))
      .filter((gram) => keep(gram[0].text) && keep(gram[size - 1].text))
      .map(joined),
  );
  return new Map(
    [...tally(found)].filter(([, count]) => count >= DENSITY_MIN_REPEAT),
  );
};

export function wordDensity(
  text: string,
  options: WordDensityOptions,
): WordDensity {
  const words = countWords(text);
  const segments = densitySegments(text, options.language);
  const keep = keptTest(options);
  const tokens = segments.flat();
  const single = ranked(
    tally(tokens.map((token) => token.text).filter(keep)),
    words,
    1,
  );
  const spaceless = tokens.filter((token) => token.spaceless).length;
  if (spaceless * 2 > tokens.length) {
    return { words, single, pairs: null, triples: null };
  }
  return {
    words,
    single,
    pairs: ranked(phrases(segments, 2, keep), words, 2),
    triples: ranked(phrases(segments, 3, keep), words, 3),
  };
}
