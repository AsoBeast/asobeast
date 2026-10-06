import { countChars } from '@asobeast/shared';
import { WIDE_CHARACTER } from '../common/text/scripts';
import { isExtractionStopword } from './extraction-stopwords';
import { isBoundWord, wordGroups } from './word-groups';
import type { WordGroup } from './word-groups';

export interface ExtractionInput {
  title: string;
  subtitle?: string;
  summary?: string;
}

export type CandidateSource = 'TITLE' | 'SUBTITLE' | 'DESCRIPTION';

export interface Candidate {
  text: string;
  source: CandidateSource;
  weight: number;
}

interface Field {
  text: string | undefined;
  source: CandidateSource;
  weight: number;
}

interface RankedCandidate extends Candidate {
  size: number;
}

const MIN_TOKEN_LENGTH = 2;
const MAX_NGRAM = 3;
const MAX_CANDIDATES = 60;
const SEGMENT_SEPARATORS = /[:.,|&]/;
const SPACELESS_PHRASE_MAX_WIDTH = 20;

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

const phraseWidth = (text: string): number =>
  [...graphemes.segment(text)].reduce(
    (width, { segment }) => width + (WIDE_CHARACTER.test(segment) ? 2 : 1),
    0,
  );

const isUsable = (token: string): boolean =>
  countChars(token) >= MIN_TOKEN_LENGTH && !isExtractionStopword(token);

function usableRuns({ tokens, joiner }: WordGroup): string[][] {
  if (joiner === ' ') {
    return [tokens.filter(isUsable)];
  }
  const runs: string[][] = [[]];
  for (const token of tokens) {
    if (isUsable(token) || isBoundWord(token)) {
      runs[runs.length - 1].push(token);
    } else {
      runs.push([]);
    }
  }
  return runs;
}

interface Gram {
  text: string;
  size: number;
}

const canStartPhrase = (token: string, asPrefix: boolean): boolean =>
  asPrefix || !isBoundWord(token);

function* ngrams(
  tokens: string[],
  joiner: WordGroup['joiner'],
  leads: boolean,
): Generator<Gram> {
  for (let size = 1; size <= MAX_NGRAM; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const text = tokens.slice(start, start + size).join(joiner);
      const fits =
        canStartPhrase(tokens[start], leads && start === 0 && size > 1) &&
        (size === 1 ||
          joiner === ' ' ||
          phraseWidth(text) <= SPACELESS_PHRASE_MAX_WIDTH);
      if (fits) {
        yield { text, size };
      }
    }
  }
}

function* fieldGrams(text: string): Generator<Gram> {
  for (const segment of text.split(SEGMENT_SEPARATORS)) {
    for (const group of wordGroups(segment)) {
      for (const [index, tokens] of usableRuns(group).entries()) {
        yield* ngrams(tokens, group.joiner, group.startsChunk && index === 0);
      }
    }
  }
}

export function extractCandidates(input: ExtractionInput): Candidate[] {
  const fields: Field[] = [
    { text: input.title, source: 'TITLE', weight: 3 },
    { text: input.subtitle, source: 'SUBTITLE', weight: 2 },
    { text: input.summary, source: 'DESCRIPTION', weight: 1 },
  ];

  const byText = new Map<string, RankedCandidate>();

  for (const field of fields) {
    if (!field.text) {
      continue;
    }
    for (const { text, size } of fieldGrams(field.text)) {
      const existing = byText.get(text);
      if (!existing || field.weight > existing.weight) {
        byText.set(text, {
          text,
          source: field.source,
          weight: field.weight,
          size,
        });
      }
    }
  }

  return [...byText.values()]
    .sort((a, b) => b.weight - a.weight || b.size - a.size)
    .slice(0, MAX_CANDIDATES)
    .map(({ text, source, weight }) => ({ text, source, weight }));
}
