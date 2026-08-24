import {
  ActionDroppedKeyword,
  ChangeField,
  RankInvestigateDropEvidence,
} from '@asobeast/shared';
import type {
  ActionChangeEvent,
  ActionContext,
  ActionContextApp,
  ActionVisibilityPoint,
} from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { isVolatile, VOLATILITY_DAMPED_CONFIDENCE } from './serp-volatility';
import { windowCutoff } from './window';

export const REGRESSION_WINDOW_DAYS = 14;
export const REGRESSION_INDEXED_FIELDS: readonly ChangeField[] = [
  'title',
  'subtitle',
  'summary',
  'description',
];
export const REGRESSION_MIN_VISIBILITY_DROP = 5;
export const REGRESSION_MIN_DROPPED_KEYWORDS = 3;
export const REGRESSION_RECOVERY_TOLERANCE = 2;
export const REGRESSION_MIN_OBSERVED_DAYS = 5;
export const REGRESSION_MEAN_DAYS = 3;
export const REGRESSION_TOTAL_SEVERITY_DROP = 20;

interface ChangeDay {
  date: string;
  fields: ChangeField[];
}

function indexedChangeDays(
  events: ActionChangeEvent[],
  cutoff: string,
): ChangeDay[] {
  const byDay = new Map<string, Set<ChangeField>>();
  for (const event of events) {
    if (!REGRESSION_INDEXED_FIELDS.includes(event.field)) continue;
    const date = event.capturedAt.toISOString().slice(0, 10);
    if (date < cutoff) continue;
    const fields = byDay.get(date) ?? new Set<ChangeField>();
    fields.add(event.field);
    byDay.set(date, fields);
  }
  return [...byDay.entries()]
    .map(([date, fields]) => ({ date, fields: [...fields].sort() }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10
  );
}

function meanBefore(
  points: ActionVisibilityPoint[],
  changedAt: string,
): number | null {
  const before = points.filter((point) => point.date < changedAt);
  return mean(
    before.slice(-REGRESSION_MEAN_DAYS).map((point) => point.visibility),
  );
}

function meanAfter(points: ActionVisibilityPoint[]): number | null {
  return mean(
    points.slice(-REGRESSION_MEAN_DAYS).map((point) => point.visibility),
  );
}

function droppedKeywords(
  app: ActionContextApp,
  country: string,
  changedAt: string,
  threshold: number,
): ActionDroppedKeyword[] {
  const dropped: ActionDroppedKeyword[] = [];
  for (const keyword of app.trackedKeywords) {
    if (keyword.country !== country || !keyword.active) continue;
    const days = (app.rankingDaysByKeyword.get(keyword.keywordId) ?? [])
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));
    const before = days.filter((day) => day.date < changedAt).at(-1);
    const after = days.at(-1);
    if (!before || !after || before === after) continue;
    if (before.position === null) continue;
    const to = after.position;
    const fall = to === null ? Number.POSITIVE_INFINITY : to - before.position;
    if (fall < threshold) continue;
    dropped.push({
      keywordId: keyword.keywordId,
      text: keyword.text,
      from: before.position,
      to,
    });
  }
  return dropped;
}

function meanVolatility(app: ActionContextApp, country: string): number | null {
  const values = app.trackedKeywords
    .filter((keyword) => keyword.country === country)
    .map((keyword) => app.volatilityByKeyword.get(keyword.keywordId) ?? null)
    .filter((value): value is number => value !== null);
  return mean(values);
}

function detectForApp(
  app: ActionContextApp,
  rankDropThreshold: number,
  now: Date,
): DetectedAction[] {
  const cutoff = windowCutoff(now, REGRESSION_WINDOW_DAYS);
  const changeDays = indexedChangeDays(app.changeEvents, cutoff);
  if (changeDays.length === 0) return [];

  const country = app.country;
  const points = (app.visibilityByCountry.get(country) ?? [])
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));

  const detections: DetectedAction[] = [];
  for (const change of changeDays) {
    const before = points.filter((point) => point.date < change.date);
    const after = points.filter((point) => point.date >= change.date);
    if (
      before.length < REGRESSION_MIN_OBSERVED_DAYS ||
      after.length < REGRESSION_MIN_OBSERVED_DAYS
    ) {
      continue;
    }

    const visibilityBefore = meanBefore(points, change.date);
    const visibilityAfter = meanAfter(points);
    const visibilityDelta =
      visibilityBefore === null || visibilityAfter === null
        ? null
        : Math.round((visibilityBefore - visibilityAfter) * 10) / 10;

    const dropped = droppedKeywords(
      app,
      country,
      change.date,
      rankDropThreshold,
    );
    const visibilityFell =
      visibilityDelta !== null &&
      visibilityDelta >= REGRESSION_MIN_VISIBILITY_DROP;
    const keywordsFell = dropped.length >= REGRESSION_MIN_DROPPED_KEYWORDS;
    if (!visibilityFell && !keywordsFell) continue;
    if (
      visibilityBefore !== null &&
      visibilityAfter !== null &&
      visibilityAfter >= visibilityBefore - REGRESSION_RECOVERY_TOLERANCE
    ) {
      continue;
    }

    const trackedKeywords = app.trackedKeywords.filter(
      (keyword) => keyword.country === country && keyword.active,
    ).length;
    const volatility = meanVolatility(app, country);
    const observedDays = Math.min(before.length, after.length);
    const damped = isVolatile(volatility);
    const baseConfidence =
      Math.min(1, observedDays / (2 * REGRESSION_MEAN_DAYS)) *
      (1 - (volatility ?? 0) / 100);

    const evidence: RankInvestigateDropEvidence = {
      rule: 'rank.investigate_drop',
      changedAt: change.date,
      fields: change.fields,
      visibilityBefore,
      visibilityAfter,
      visibilityDelta,
      windowDays: REGRESSION_WINDOW_DAYS,
      trackedKeywords,
      droppedKeywords: dropped,
      meanVolatility: volatility,
    };

    detections.push({
      rule: 'rank.investigate_drop',
      appId: app.id,
      store: app.store,
      country,
      keywordId: null,
      discriminator: change.date,
      terms: {
        reach: dropped.length / Math.max(trackedKeywords, 1),
        severity: (visibilityDelta ?? 0) / REGRESSION_TOTAL_SEVERITY_DROP,
        confidence: damped
          ? Math.min(VOLATILITY_DAMPED_CONFIDENCE, baseConfidence)
          : baseConfidence,
      },
      evidence,
      ...(damped ? { dampenedBy: 'serp.hold_volatile' as const } : {}),
    });
  }
  return detections;
}

export function detectRankInvestigateDrop(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps.flatMap((app) =>
    detectForApp(app, context.rankDropThreshold, now),
  );
}

export const rankInvestigateDropDetector: ActionDetector = {
  rule: 'rank.investigate_drop',
  detect: detectRankInvestigateDrop,
};
