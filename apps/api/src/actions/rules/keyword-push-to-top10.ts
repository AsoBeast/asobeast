import {
  KeywordCoverageRow,
  KeywordPushToTop10Evidence,
  MetadataField,
  Store,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { OPPORTUNITY_MIN_RELEVANCE } from '../../scoring/opportunity';
import type {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import { clampUnit, scoreImpact } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { detectKeywordDefend } from './keyword-defend';
import { isVolatile } from './serp-volatility';
import { windowCutoff } from './window';

export const PUSH_MIN_POSITION = 11;
export const PUSH_MAX_POSITION = 20;
export const PUSH_WINDOW_DAYS = 7;
export const PUSH_MIN_DAYS_IN_BAND = 5;
export const PUSH_MIN_VOLUME = 20;
export const PUSH_MIN_RELEVANCE = OPPORTUNITY_MIN_RELEVANCE;
export const PUSH_MAX_PER_APP = 5;
export const PUSH_STRONG_FIELDS: Record<Store, readonly MetadataField[]> = {
  APP_STORE: ['title', 'subtitle'],
  GOOGLE_PLAY: ['title', 'shortDescription'],
};

const inBand = (position: number | null): position is number =>
  position !== null &&
  position >= PUSH_MIN_POSITION &&
  position <= PUSH_MAX_POSITION;

interface BandHistory {
  daysInBand: number;
  bestPosition: number;
  firstRanked: number | null;
}

function bandHistory(days: ActionRankingDay[], now: Date): BandHistory {
  const cutoff = windowCutoff(now, PUSH_WINDOW_DAYS);
  const window = days
    .filter((day) => day.date >= cutoff)
    .sort((left, right) => left.date.localeCompare(right.date));
  const ranked = window
    .map((day) => day.position)
    .filter((position): position is number => position !== null);
  return {
    daysInBand: window.filter((day) => inBand(day.position)).length,
    bestPosition: Math.min(...ranked),
    firstRanked: ranked[0] ?? null,
  };
}

function qualifies(
  keyword: TrackedKeywordItem,
  homeCountry: string,
): keyword is TrackedKeywordItem & { latestPosition: number } {
  return (
    keyword.active &&
    keyword.country === homeCountry &&
    !keyword.scoreOutdated &&
    keyword.relevance !== null &&
    keyword.relevance >= PUSH_MIN_RELEVANCE &&
    (keyword.volume ?? 0) >= PUSH_MIN_VOLUME &&
    inBand(keyword.latestPosition)
  );
}

function weaklyCovered(
  row: KeywordCoverageRow | undefined,
  store: Store,
): MetadataField[] | null {
  if (!row || row.uncovered) return null;
  const covered = row.fields
    .filter((field) => field.covered)
    .map((field) => field.field);
  const strong = PUSH_STRONG_FIELDS[store];
  return covered.some((field) => strong.includes(field)) ? null : covered;
}

function candidate(
  app: ActionContextApp,
  keyword: TrackedKeywordItem,
  now: Date,
): DetectedAction | null {
  if (!qualifies(keyword, app.country)) return null;
  const history = bandHistory(
    app.rankingDaysByKeyword.get(keyword.keywordId) ?? [],
    now,
  );
  if (history.daysInBand < PUSH_MIN_DAYS_IN_BAND) return null;
  if (
    history.firstRanked !== null &&
    keyword.latestPosition > history.firstRanked
  ) {
    return null;
  }
  const coveredFields = weaklyCovered(
    app.coverage.find((row) => row.keywordId === keyword.keywordId),
    app.store,
  );
  if (coveredFields === null) return null;

  const evidence: KeywordPushToTop10Evidence = {
    rule: 'keyword.push_to_top10',
    latestPosition: keyword.latestPosition,
    bestPosition: history.bestPosition,
    daysInBand: history.daysInBand,
    windowDays: PUSH_WINDOW_DAYS,
    volume: keyword.volume,
    relevance: keyword.relevance,
    opportunity: keyword.opportunity,
    coveredFields,
    strongFields: [...PUSH_STRONG_FIELDS[app.store]],
  };
  return {
    rule: 'keyword.push_to_top10',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: keyword.keywordId,
    discriminator: null,
    terms: {
      reach: (keyword.volume ?? 0) / 100,
      severity: clampUnit(
        (PUSH_MAX_POSITION + 1 - keyword.latestPosition) / 10,
      ),
      confidence: history.daysInBand / PUSH_WINDOW_DAYS,
    },
    evidence,
  };
}

const impactOf = (detection: DetectedAction): number =>
  scoreImpact(detection.rule, detection.terms).impact;

function detectForApp(
  app: ActionContextApp,
  claimed: ReadonlySet<string>,
  now: Date,
): DetectedAction[] {
  const candidates = app.trackedKeywords
    .map((keyword) => candidate(app, keyword, now))
    .filter((detection): detection is DetectedAction => detection !== null);
  const blocked = (detection: DetectedAction): boolean =>
    claimed.has(`${app.id}:${detection.keywordId}`) ||
    isVolatile(app.volatilityByKeyword.get(detection.keywordId ?? '') ?? null);

  const ranked = candidates
    .filter((detection) => !blocked(detection))
    .sort(
      (left, right) =>
        impactOf(right) - impactOf(left) ||
        (left.keywordId ?? '').localeCompare(right.keywordId ?? ''),
    );
  const kept = ranked.slice(0, PUSH_MAX_PER_APP);
  return [
    ...kept,
    ...candidates
      .filter((detection) => !kept.includes(detection))
      .map((detection) => ({ ...detection, withheld: true as const })),
  ];
}

export function detectKeywordPushToTop10(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  const claimed = new Set(
    detectKeywordDefend(context, now).map(
      (detection) => `${detection.appId}:${detection.keywordId}`,
    ),
  );
  return context.apps.flatMap((app) => detectForApp(app, claimed, now));
}

export const keywordPushToTop10Detector: ActionDetector = {
  rule: 'keyword.push_to_top10',
  detect: detectKeywordPushToTop10,
};
