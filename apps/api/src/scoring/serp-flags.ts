import { SERP_FLAGS, SerpFlag, searchKey } from '@asobeast/shared';
import { finiteNumbers, median } from './curves';
import { editDistance } from './edit-distance';
import {
  EVIDENCE_ALL_WORDS,
  paddingFactor,
  titleEvidence,
} from './serp-signals';

export const BRAND_MIN_LEADER_RATINGS = 10_000;
export const BRAND_LEADER_RATIO = 10;
export const WEAK_LEADER_MAX_RATINGS = 100;
export const SMALL_SERP_MAX_RESULTS = 3;
export const PADDED_MAX_FACTOR = 0.5;
export const BRAND_TYPO_MIN_LENGTH = 6;
export const BRAND_DOUBLE_TYPO_MIN_LENGTH = 9;

const TITLE_SEPARATOR = /\s[-–—|·•]\s|[:,]/;
const DEVELOPER_SUFFIXES = new Set([
  'inc',
  'llc',
  'ltd',
  'limited',
  'gmbh',
  'ab',
  'oy',
  'as',
  'bv',
  'sa',
  'srl',
  'co',
  'corp',
  'corporation',
  'company',
  'games',
  'studio',
  'studios',
  'mobile',
  'labs',
  'apps',
  'entertainment',
  'interactive',
]);

interface FlaggableApp {
  title: string;
  developer?: string;
  ratingCount?: number;
}

export interface FlaggablePage {
  keywordText: string;
  resultCount: number;
  top10: FlaggableApp[];
}

function typoTolerance(phrase: string): number {
  const joined = phrase.replaceAll(' ', '');
  if (!phrase.includes(' ') && joined.length >= BRAND_DOUBLE_TYPO_MIN_LENGTH) {
    return 2;
  }
  return joined.length >= BRAND_TYPO_MIN_LENGTH ? 1 : 0;
}

function misspells(name: string, phrase: string): boolean {
  if (name === phrase) {
    return true;
  }
  const tokens = new Set(name.split(' '));
  if (phrase.split(' ').every((word) => tokens.has(word))) {
    return false;
  }
  return (
    editDistance(name.replaceAll(' ', ''), phrase.replaceAll(' ', '')) <=
    typoTolerance(phrase)
  );
}

function namedAfter(leader: FlaggableApp, keyword: string): boolean {
  const phrase = searchKey(keyword);
  if (phrase.length === 0) {
    return false;
  }
  const [segment = ''] = leader.title.split(TITLE_SEPARATOR);
  if (misspells(searchKey(segment), phrase)) {
    return true;
  }
  const words = searchKey(leader.developer ?? '').split(' ');
  const core = words.filter((word) => !DEVELOPER_SUFFIXES.has(word));
  if (core.length === 0) {
    return false;
  }
  return words.join(' ') === phrase || core.join(' ') === phrase;
}

function leaderRatings(page: FlaggablePage): number | null {
  const [count] = finiteNumbers([page.top10[0]?.ratingCount]);
  return count ?? null;
}

function isBrand(page: FlaggablePage, leader: number | null): boolean {
  if (leader === null || leader < BRAND_MIN_LEADER_RATINGS) {
    return false;
  }
  const rivals = page.top10
    .slice(1)
    .filter(
      (item) =>
        titleEvidence(item.title, page.keywordText) >= EVIDENCE_ALL_WORDS,
    );
  const rest = median(finiteNumbers(rivals.map((item) => item.ratingCount)));
  return (
    leader >= BRAND_LEADER_RATIO * Math.max(rest, 1) &&
    namedAfter(page.top10[0], page.keywordText)
  );
}

export function serpFlags(page: FlaggablePage): SerpFlag[] {
  const leader = leaderRatings(page);
  const raised: Record<SerpFlag, boolean> = {
    brand: isBrand(page, leader),
    weak_leader: leader !== null && leader < WEAK_LEADER_MAX_RATINGS,
    small_serp: page.resultCount <= SMALL_SERP_MAX_RESULTS,
    padded: paddingFactor(page.top10, page.keywordText) <= PADDED_MAX_FACTOR,
  };
  return SERP_FLAGS.filter((flag) => raised[flag]);
}
