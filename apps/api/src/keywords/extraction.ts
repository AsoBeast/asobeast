import { isStopword, tokenize } from '@asobeast/shared';

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

const MIN_TOKEN_LENGTH = 2;
const MAX_NGRAM = 3;
const MAX_CANDIDATES = 60;
const SEGMENT_SEPARATORS = /[:.,|&]/;

export function extractCandidates(input: ExtractionInput): Candidate[] {
  const fields: Field[] = [
    { text: input.title, source: 'TITLE', weight: 3 },
    { text: input.subtitle, source: 'SUBTITLE', weight: 2 },
    { text: input.summary, source: 'DESCRIPTION', weight: 1 },
  ];

  const byText = new Map<string, Candidate>();

  for (const field of fields) {
    if (!field.text) {
      continue;
    }
    for (const segment of field.text.split(SEGMENT_SEPARATORS)) {
      const tokens = tokenize(segment).filter(
        (token) => token.length >= MIN_TOKEN_LENGTH && !isStopword(token),
      );
      for (let n = 1; n <= MAX_NGRAM; n += 1) {
        for (let i = 0; i + n <= tokens.length; i += 1) {
          const text = tokens.slice(i, i + n).join(' ');
          const existing = byText.get(text);
          if (!existing || field.weight > existing.weight) {
            byText.set(text, {
              text,
              source: field.source,
              weight: field.weight,
            });
          }
        }
      }
    }
  }

  return [...byText.values()]
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        b.text.split(' ').length - a.text.split(' ').length,
    )
    .slice(0, MAX_CANDIDATES);
}
