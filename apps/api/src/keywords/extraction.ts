import { countChars } from '@asobeast/shared';
import { isExtractionStopword } from './extraction-stopwords';
import { wordGroups } from './word-groups';
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
const SPACELESS_PHRASE_MAX_CHARS = 10;

const isUsable = (token: string): boolean =>
  countChars(token) >= MIN_TOKEN_LENGTH && !isExtractionStopword(token);

function usableRuns({ tokens, joiner }: WordGroup): string[][] {
  if (joiner === ' ') {
    return [tokens.filter(isUsable)];
  }
  const runs: string[][] = [[]];
  for (const token of tokens) {
    if (isUsable(token)) {
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

function* ngrams(
  tokens: string[],
  joiner: WordGroup['joiner'],
): Generator<Gram> {
  for (let size = 1; size <= MAX_NGRAM; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const text = tokens.slice(start, start + size).join(joiner);
      const fits =
        size === 1 ||
        joiner === ' ' ||
        countChars(text) <= SPACELESS_PHRASE_MAX_CHARS;
      if (fits) {
        yield { text, size };
      }
    }
  }
}

function* fieldGrams(text: string): Generator<Gram> {
  for (const segment of text.split(SEGMENT_SEPARATORS)) {
    for (const group of wordGroups(segment)) {
      for (const tokens of usableRuns(group)) {
        yield* ngrams(tokens, group.joiner);
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
