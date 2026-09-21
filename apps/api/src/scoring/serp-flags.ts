import { SERP_FLAGS, SerpFlag, searchKey } from '@asobeast/shared';
import { finiteNumbers, median } from './curves';
import { paddingFactor } from './serp-signals';

export const BRAND_MIN_LEADER_RATINGS = 10_000;
export const BRAND_LEADER_RATIO = 10;
export const WEAK_LEADER_MAX_RATINGS = 100;
export const SMALL_SERP_MAX_RESULTS = 3;
export const PADDED_MAX_FACTOR = 0.5;

const TITLE_SEPARATOR = /\s[-–—|]\s|:/;

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

function namedAfter(leader: FlaggableApp, keyword: string): boolean {
  const phrase = searchKey(keyword);
  if (phrase.length === 0) {
    return false;
  }
  const [segment = ''] = leader.title.split(TITLE_SEPARATOR);
  if (searchKey(segment) === phrase) {
    return true;
  }
  const developerWords = new Set(searchKey(leader.developer ?? '').split(' '));
  return phrase.split(' ').every((word) => developerWords.has(word));
}

function leaderRatings(page: FlaggablePage): number | null {
  const [count] = finiteNumbers([page.top10[0]?.ratingCount]);
  return count ?? null;
}

function isBrand(page: FlaggablePage, leader: number | null): boolean {
  if (leader === null || leader < BRAND_MIN_LEADER_RATINGS) {
    return false;
  }
  const rest = median(
    finiteNumbers(page.top10.slice(1).map((item) => item.ratingCount)),
  );
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
