export const SPIDER_TERM_MIN_LENGTH = 2;
export const SPIDER_TERM_MAX_LENGTH = 40;

export function isSpiderTerm(term: string): boolean {
  const length = term.trim().length;
  return length >= SPIDER_TERM_MIN_LENGTH && length <= SPIDER_TERM_MAX_LENGTH;
}

export interface SpiderEnqueueResult {
  enqueued: number;
}

export interface SpiderSuggestion {
  text: string;
  priority: number | null;
  probes: number;
}

export interface SpiderStatus {
  term: string;
  probesDone: number;
  probesTotal: number;
  complete: boolean;
  suggestions: SpiderSuggestion[];
}
