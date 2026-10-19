import { Store } from '@prisma/client';
import type {
  KeywordBreakdownApp,
  KeywordBreakdownChange,
  KeywordBreakdownInsight,
  KeywordBreakdownStanding,
} from '@asobeast/shared';
import { PLACEMENT_STRENGTH, wordMatches } from './keyword-breakdown-fields';

export const RATINGS_GAP_FACTOR = 3;
export const RATINGS_MIN_GAP = 100;
export const SETTLING_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;
const SPLIT = PLACEMENT_STRENGTH.split;

export function ranksAbove(
  app: KeywordBreakdownApp,
  you: KeywordBreakdownApp,
): boolean {
  const theirs = app.ranking?.position ?? null;
  if (theirs === null || you.ranking === null) return false;
  return you.ranking.position === null || theirs < you.ranking.position;
}

function ratingsGap(
  app: KeywordBreakdownApp,
  you: KeywordBreakdownApp,
  market: string,
): { theirs: number; yours: number } | null {
  if (app.rating?.country !== market || you.rating?.country !== market) {
    return null;
  }
  const theirs = app.rating.count;
  const yours = you.rating.count;
  if (theirs === null || yours === null) return null;
  const far =
    theirs >= RATINGS_GAP_FACTOR * Math.max(yours, 1) &&
    theirs - yours >= RATINGS_MIN_GAP;
  return far ? { theirs, yours } : null;
}

function spellingWords(
  app: KeywordBreakdownApp,
  you: KeywordBreakdownApp,
  words: readonly string[],
): string[] {
  const theirs = wordMatches(app.listings, words);
  const yours = wordMatches(you.listings, words);
  return words.filter(
    (word) => theirs.get(word) === 'exact' && yours.get(word) === 'folded',
  );
}

export interface BreakdownScope {
  store: Store;
  market: string;
  words: readonly string[];
}

export function insightFor(
  app: KeywordBreakdownApp,
  you: KeywordBreakdownApp,
  { store, market, words }: BreakdownScope,
): KeywordBreakdownInsight {
  const strength = PLACEMENT_STRENGTH[app.placement];
  if (strength > PLACEMENT_STRENGTH[you.placement]) {
    return { rule: 'placement', theirs: app.placement, yours: you.placement };
  }
  const spelling = spellingWords(app, you, words);
  if (spelling.length > 0) return { rule: 'spelling', words: spelling };
  const ratings = ratingsGap(app, you, market);
  if (ratings) return { rule: 'ratings', ...ratings };
  if (strength < SPLIT && app.unread.length > 0) {
    return { rule: 'unread', localizations: app.unread };
  }
  if (store === Store.APP_STORE && strength < SPLIT) return { rule: 'hidden' };
  return { rule: 'similar' };
}

export function withInsights(
  apps: readonly KeywordBreakdownApp[],
  scope: BreakdownScope,
): KeywordBreakdownApp[] {
  const you = apps.find((app) => app.isYou);
  if (!you) return [...apps];
  return apps.map((app) =>
    !app.isYou && ranksAbove(app, you)
      ? { ...app, insight: insightFor(app, you, scope) }
      : app,
  );
}

export function standingOf(
  apps: readonly KeywordBreakdownApp[],
  words: readonly string[],
  recent: KeywordBreakdownChange | null,
): KeywordBreakdownStanding {
  const you = apps.find((app) => app.isYou);
  const competitors = apps.filter((app) => !app.isYou);
  const matches = wordMatches(you?.listings ?? [], words);
  return {
    checked: (you?.ranking ?? null) !== null,
    above: you ? competitors.filter((app) => ranksAbove(app, you)).length : 0,
    competitors: competitors.length,
    missingWords: words.filter((word) => matches.get(word) === 'none'),
    foldedWords: words.filter((word) => matches.get(word) === 'folded'),
    recentChange: recent,
  };
}

export function recentChange(
  changes: { listing: Date | null; keywordField: Date | null },
  now: Date,
): KeywordBreakdownChange | null {
  const { listing, keywordField } = changes;
  const newest =
    keywordField && (!listing || keywordField > listing)
      ? { at: keywordField, source: 'keywordField' as const }
      : listing && { at: listing, source: 'listing' as const };
  if (!newest || now.getTime() - newest.at.getTime() > SETTLING_DAYS * DAY_MS) {
    return null;
  }
  return { date: newest.at.toISOString().slice(0, 10), source: newest.source };
}
