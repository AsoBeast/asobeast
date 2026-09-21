import { searchKey } from '@asobeast/shared';
import { clamp } from './curves';

export const EVIDENCE_EXACT = 1;
export const EVIDENCE_ALL_WORDS = 0.7;
export const EVIDENCE_PARTIAL = 0.4;
export const PADDING_SLOPE = 2.5;
export const PADDING_FLOOR = 0.25;

export interface TitledApp {
  title: string;
}

export function titleEvidence(title: string, keyword: string): number {
  const phrase = searchKey(keyword);
  if (phrase.length === 0) {
    return 0;
  }
  const haystack = searchKey(title);
  if (haystack.includes(phrase)) {
    return EVIDENCE_EXACT;
  }
  const words = phrase.split(' ');
  const present = words.filter((word) => haystack.includes(word)).length;
  return present === words.length
    ? EVIDENCE_ALL_WORDS
    : (present / words.length) * EVIDENCE_PARTIAL;
}

export function serpRelevance(topTen: TitledApp[], keyword: string): number {
  if (topTen.length === 0) {
    return 0;
  }
  const total = topTen.reduce(
    (sum, item) => sum + titleEvidence(item.title, keyword),
    0,
  );
  return total / topTen.length;
}

export const paddingFactor = (topTen: TitledApp[], keyword: string): number =>
  clamp(serpRelevance(topTen, keyword) * PADDING_SLOPE, PADDING_FLOOR, 1);
