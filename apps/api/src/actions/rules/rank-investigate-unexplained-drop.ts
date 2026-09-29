import {
  ActionDroppedKeyword,
  RankInvestigateUnexplainedDropEvidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import type {
  ActionContext,
  ActionContextApp,
  ActionVisibilityPoint,
} from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';
import {
  mean,
  meanVolatility,
  REGRESSION_INDEXED_FIELDS,
  REGRESSION_MIN_DROPPED_KEYWORDS,
  REGRESSION_MIN_VISIBILITY_DROP,
  REGRESSION_RECOVERY_TOLERANCE,
  REGRESSION_TOTAL_SEVERITY_DROP,
} from './rank-investigate-drop';
import { isVolatile, VOLATILITY_DAMPED_CONFIDENCE } from './serp-volatility';
import { dateDaysAgo, windowStart } from './window';

export const UNEXPLAINED_WINDOW_DAYS = 14;
export const UNEXPLAINED_RECENT_DAYS = 3;
export const UNEXPLAINED_BASELINE_FROM_DAYS = 8;
export const UNEXPLAINED_KEYWORD_LOOKBACK_DAYS = 7;
export const UNEXPLAINED_MIN_KEYWORDS = 5;
export const UNEXPLAINED_MIN_BASELINE_POINTS = 3;
export const UNEXPLAINED_MIN_VISIBILITY_DROP = REGRESSION_MIN_VISIBILITY_DROP;
export const UNEXPLAINED_MIN_DROPPED_KEYWORDS = REGRESSION_MIN_DROPPED_KEYWORDS;
export const UNEXPLAINED_TOTAL_SEVERITY_DROP = REGRESSION_TOTAL_SEVERITY_DROP;

const round1 = (value: number): number => Math.round(value * 10) / 10;

function lastOwnChange(app: ActionContextApp): string | null {
  const dates = app.changeEvents
    .filter((event) => REGRESSION_INDEXED_FIELDS.includes(event.field))
    .map((event) => event.capturedAt.toISOString().slice(0, 10))
    .sort();
  return dates.at(-1) ?? null;
}

function droppedSince(
  app: ActionContextApp,
  keywords: TrackedKeywordItem[],
  since: string,
  threshold: number,
): ActionDroppedKeyword[] {
  return keywords.flatMap((keyword) => {
    const days = (app.rankingDaysByKeyword.get(keyword.keywordId) ?? [])
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));
    const before = days.filter((day) => day.date <= since).at(-1);
    const latest = days.at(-1);
    if (!before || !latest || latest.date <= before.date) return [];
    if (before.position === null) return [];
    const fall =
      latest.position === null
        ? Number.POSITIVE_INFINITY
        : latest.position - before.position;
    if (fall < threshold) return [];
    return [
      {
        keywordId: keyword.keywordId,
        text: keyword.text,
        from: before.position,
        to: latest.position,
      },
    ];
  });
}

interface VisibilityShift {
  before: number;
  after: number;
  points: number;
}

function visibilityShift(
  series: ActionVisibilityPoint[],
  now: Date,
): VisibilityShift | null {
  const from = windowStart(now, UNEXPLAINED_WINDOW_DAYS);
  const baselineTo = dateDaysAgo(now, UNEXPLAINED_BASELINE_FROM_DAYS);
  const points = series
    .filter((point) => point.date >= from)
    .sort((left, right) => left.date.localeCompare(right.date));
  const baseline = points.filter((point) => point.date <= baselineTo);
  if (baseline.length < UNEXPLAINED_MIN_BASELINE_POINTS) return null;
  const before = mean(baseline.map((point) => point.visibility));
  const after = mean(
    points.slice(-UNEXPLAINED_RECENT_DAYS).map((point) => point.visibility),
  );
  if (before === null || after === null) return null;
  return { before, after, points: points.length };
}

function detectInCountry(
  app: ActionContextApp,
  country: string,
  rankDropThreshold: number,
  now: Date,
): DetectedAction | null {
  const active = (app.keywordsByCountry.get(country) ?? []).filter(
    (keyword) => keyword.active,
  );
  if (active.length < UNEXPLAINED_MIN_KEYWORDS) return null;
  const shift = visibilityShift(
    app.visibilityByCountry.get(country) ?? [],
    now,
  );
  if (shift === null) return null;

  const delta = round1(shift.before - shift.after);
  const dropped = droppedSince(
    app,
    active,
    dateDaysAgo(now, UNEXPLAINED_KEYWORD_LOOKBACK_DAYS),
    rankDropThreshold,
  );
  if (delta <= 0) return null;
  if (
    delta < UNEXPLAINED_MIN_VISIBILITY_DROP &&
    dropped.length < UNEXPLAINED_MIN_DROPPED_KEYWORDS
  ) {
    return null;
  }
  if (shift.after >= shift.before - REGRESSION_RECOVERY_TOLERANCE) {
    return null;
  }

  const home = country === app.country;
  const lastOwnChangeAt = home ? lastOwnChange(app) : null;
  const explained =
    lastOwnChangeAt !== null &&
    lastOwnChangeAt >= windowStart(now, UNEXPLAINED_WINDOW_DAYS);
  const volatility = meanVolatility(app, country);
  const baseConfidence =
    clampUnit(shift.points / UNEXPLAINED_WINDOW_DAYS) *
    (1 - (volatility ?? 0) / 100);
  const totalActive = app.trackedKeywords.filter(
    (keyword) => keyword.active,
  ).length;

  const evidence: RankInvestigateUnexplainedDropEvidence = {
    rule: 'rank.investigate_unexplained_drop',
    country,
    visibilityBefore: shift.before,
    visibilityAfter: shift.after,
    visibilityDelta: delta,
    windowDays: UNEXPLAINED_WINDOW_DAYS,
    trackedKeywords: active.length,
    droppedKeywords: dropped,
    meanVolatility: volatility,
    lastOwnChangeAt,
  };
  return {
    rule: 'rank.investigate_unexplained_drop',
    appId: app.id,
    store: app.store,
    country,
    keywordId: null,
    discriminator: null,
    terms: {
      reach: active.length / Math.max(totalActive, 1),
      severity: clampUnit(delta / UNEXPLAINED_TOTAL_SEVERITY_DROP),
      confidence: isVolatile(volatility)
        ? Math.min(VOLATILITY_DAMPED_CONFIDENCE, baseConfidence)
        : baseConfidence,
    },
    evidence,
    ...(explained ? { withheld: true as const } : {}),
  };
}

export function detectRankInvestigateUnexplainedDrop(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps.flatMap((app) =>
    [...app.keywordsByCountry.keys()]
      .map((country) =>
        detectInCountry(app, country, context.rankDropThreshold, now),
      )
      .filter((detection): detection is DetectedAction => detection !== null),
  );
}

export const rankInvestigateUnexplainedDropDetector: ActionDetector = {
  rule: 'rank.investigate_unexplained_drop',
  detect: detectRankInvestigateUnexplainedDrop,
};
