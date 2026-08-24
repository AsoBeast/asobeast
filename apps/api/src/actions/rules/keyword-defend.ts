import {
  ActionSerpEntrant,
  KeywordDefendEvidence,
  SERP_DEPTH,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { detectEntrants, SerpSnapshotDay } from '../../rankings/serp-movers';
import type {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { windowCutoff } from './window';
import { VOLATILITY_DAMPED_CONFIDENCE, isVolatile } from './serp-volatility';

export const DEFEND_WINDOW_DAYS = 7;
export const DEFEND_MIN_ENTRANTS = 2;
export const DEFEND_MIN_OBSERVED_DAYS = 4;
export const DEFEND_YOUR_POSITION_MAX = 20;
export const DEFEND_NEUTRAL_VOLUME = 40;
export const DEFEND_PRESSURE_WEIGHT = 0.4;
export const DEFEND_ENTRANT_PRESSURE_CAP = 3;

function withinWindow<T extends { date: string }>(
  rows: T[],
  cutoff: string,
): T[] {
  return rows.filter((row) => row.date >= cutoff);
}

interface DefendPosition {
  latest: number | null;
  previous: number | null;
  heldTopTen: boolean;
}

function positionsInWindow(days: ActionRankingDay[]): DefendPosition {
  const ordered = [...days].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const ranked = ordered.filter((day) => day.position !== null);
  return {
    latest: ordered.at(-1)?.position ?? null,
    previous: ranked[0]?.position ?? null,
    heldTopTen: ranked.some(
      (day) => day.position !== null && day.position <= SERP_DEPTH,
    ),
  };
}

function defensible(position: DefendPosition): boolean {
  if (position.latest !== null) {
    return position.latest <= DEFEND_YOUR_POSITION_MAX;
  }
  return position.heldTopTen;
}

function entrantsFor(
  snapshots: SerpSnapshotDay[],
  ownStoreAppId: string,
  competitorAppIds: Map<string, string>,
): ActionSerpEntrant[] {
  const latest = new Map<string, ActionSerpEntrant>();
  for (const entrant of detectEntrants(snapshots)) {
    if (entrant.storeAppId === ownStoreAppId) continue;
    latest.set(entrant.storeAppId, {
      storeAppId: entrant.storeAppId,
      title: entrant.title,
      position: entrant.position,
      appId: competitorAppIds.get(entrant.storeAppId) ?? null,
      isCompetitor: competitorAppIds.has(entrant.storeAppId),
    });
  }
  return [...latest.values()].sort(
    (left, right) => left.position - right.position,
  );
}

function positionPressure(yourPosition: number | null): number {
  if (yourPosition === null) return 1;
  return Math.min(
    1,
    Math.max(0, (SERP_DEPTH + 1 - Math.min(yourPosition, SERP_DEPTH)) / 10),
  );
}

function detectForKeyword(
  app: ActionContextApp,
  keyword: TrackedKeywordItem,
  now: Date,
): DetectedAction | null {
  const cutoff = windowCutoff(now, DEFEND_WINDOW_DAYS);
  const snapshots = withinWindow(
    app.serpDaysByKeyword.get(keyword.keywordId) ?? [],
    cutoff,
  );
  const observedDays = new Set(snapshots.map((day) => day.date)).size;
  if (observedDays < DEFEND_MIN_OBSERVED_DAYS) return null;

  const position = positionsInWindow(
    withinWindow(app.rankingDaysByKeyword.get(keyword.keywordId) ?? [], cutoff),
  );
  if (!defensible(position)) return null;

  const entrants = entrantsFor(
    snapshots,
    app.storeAppId,
    app.competitorAppIdsByStoreAppId,
  );
  if (entrants.length < DEFEND_MIN_ENTRANTS) return null;

  const threshold = position.latest ?? Number.POSITIVE_INFINITY;
  const entrantsAtOrAbove = entrants.filter(
    (entrant) => entrant.position <= threshold,
  ).length;
  if (entrantsAtOrAbove === 0) return null;

  const volatility = app.volatilityByKeyword.get(keyword.keywordId) ?? null;
  const damped = isVolatile(volatility);
  const confidence = damped
    ? Math.min(VOLATILITY_DAMPED_CONFIDENCE, observedDays / DEFEND_WINDOW_DAYS)
    : observedDays / DEFEND_WINDOW_DAYS;

  const evidence: KeywordDefendEvidence = {
    rule: 'keyword.defend',
    yourPosition: position.latest,
    previousPosition: position.previous,
    windowDays: DEFEND_WINDOW_DAYS,
    observedDays,
    volatility,
    entrants,
    entrantsAtOrAbove,
    volume: keyword.volume,
  };

  return {
    rule: 'keyword.defend',
    appId: app.id,
    store: app.store,
    country: keyword.country,
    keywordId: keyword.keywordId,
    discriminator: null,
    terms: {
      reach: (keyword.volume ?? DEFEND_NEUTRAL_VOLUME) / 100,
      severity:
        Math.min(1, entrantsAtOrAbove / DEFEND_ENTRANT_PRESSURE_CAP) *
          (1 - DEFEND_PRESSURE_WEIGHT) +
        positionPressure(position.latest) * DEFEND_PRESSURE_WEIGHT,
      confidence,
    },
    evidence,
    ...(damped ? { dampenedBy: 'serp.hold_volatile' as const } : {}),
  };
}

export function detectKeywordDefend(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps.flatMap((app) =>
    app.trackedKeywords
      .filter((keyword) => keyword.active)
      .map((keyword) => detectForKeyword(app, keyword, now))
      .filter((detection): detection is DetectedAction => detection !== null),
  );
}

export const keywordDefendDetector: ActionDetector = {
  rule: 'keyword.defend',
  detect: detectKeywordDefend,
};
