import { ActionRule, SerpHoldVolatileEvidence } from '@asobeast/shared';
import type { ActionContext, ActionContextApp } from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { detectKeywordDefend } from './keyword-defend';
import { windowCutoff } from './window';
import { detectRankInvestigateDrop } from './rank-investigate-drop';
import {
  isVolatile,
  VOLATILITY_MIN_OBSERVED_DAYS,
  VOLATILITY_WINDOW_DAYS,
} from './serp-volatility';

export {
  VOLATILITY_MIN_OBSERVED_DAYS,
  VOLATILITY_THRESHOLD,
  VOLATILITY_WINDOW_DAYS,
} from './serp-volatility';

type DampableDetector = (context: ActionContext, now: Date) => DetectedAction[];

const DAMPABLE_DETECTORS: readonly DampableDetector[] = [
  detectKeywordDefend,
  detectRankInvestigateDrop,
];

interface DampedKeyword {
  rules: ActionRule[];
  reach: number;
  yourPosition: number | null;
}

function record(
  damped: Map<string, DampedKeyword>,
  key: string,
  entry: DampedKeyword,
): void {
  const existing = damped.get(key);
  if (!existing) {
    damped.set(key, entry);
    return;
  }
  for (const rule of entry.rules) {
    if (!existing.rules.includes(rule)) existing.rules.push(rule);
  }
  existing.reach = Math.max(existing.reach, entry.reach);
  existing.yourPosition = existing.yourPosition ?? entry.yourPosition;
}

function volatileKeywordIds(
  context: ActionContext,
  appId: string,
  country: string,
): string[] {
  const app = context.apps.find((candidate) => candidate.id === appId);
  if (!app) return [];
  return app.trackedKeywords
    .filter(
      (keyword) =>
        keyword.country === country &&
        isVolatile(app.volatilityByKeyword.get(keyword.keywordId) ?? null),
    )
    .map((keyword) => keyword.keywordId);
}

function collectDamped(
  context: ActionContext,
  now: Date,
): Map<string, DampedKeyword> {
  const damped = new Map<string, DampedKeyword>();
  for (const detect of DAMPABLE_DETECTORS) {
    for (const detection of detect(context, now)) {
      if (detection.dampenedBy !== 'serp.hold_volatile') continue;
      const entry: DampedKeyword = {
        rules: [detection.rule],
        reach: detection.terms.reach,
        yourPosition:
          detection.evidence.rule === 'keyword.defend'
            ? detection.evidence.yourPosition
            : null,
      };
      const keywordIds =
        detection.keywordId === null
          ? volatileKeywordIds(context, detection.appId, detection.country)
          : [detection.keywordId];
      for (const keywordId of keywordIds) {
        record(damped, `${detection.appId}~${keywordId}`, { ...entry });
      }
    }
  }
  return damped;
}

function detectForApp(
  app: ActionContextApp,
  damped: Map<string, DampedKeyword>,
  now: Date,
): DetectedAction[] {
  const cutoff = windowCutoff(now, VOLATILITY_WINDOW_DAYS);
  const detections: DetectedAction[] = [];

  for (const keyword of app.trackedKeywords) {
    const entry = damped.get(`${app.id}~${keyword.keywordId}`);
    if (!entry) continue;

    const volatility = app.volatilityByKeyword.get(keyword.keywordId) ?? null;
    if (!isVolatile(volatility) || volatility === null) continue;

    const observedDays = new Set(
      (app.serpDaysByKeyword.get(keyword.keywordId) ?? [])
        .filter((day) => day.date >= cutoff)
        .map((day) => day.date),
    ).size;
    if (observedDays < VOLATILITY_MIN_OBSERVED_DAYS) continue;

    const evidence: SerpHoldVolatileEvidence = {
      rule: 'serp.hold_volatile',
      volatility,
      windowDays: VOLATILITY_WINDOW_DAYS,
      observedDays,
      yourPosition: entry.yourPosition,
      dampenedRules: [...entry.rules].sort(),
    };

    detections.push({
      rule: 'serp.hold_volatile',
      appId: app.id,
      store: app.store,
      country: keyword.country,
      keywordId: keyword.keywordId,
      discriminator: null,
      terms: {
        reach: entry.reach,
        severity: volatility / 100,
        confidence: observedDays / VOLATILITY_WINDOW_DAYS,
      },
      evidence,
    });
  }
  return detections;
}

export function detectSerpHoldVolatile(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  const damped = collectDamped(context, now);
  if (damped.size === 0) return [];
  return context.apps.flatMap((app) => detectForApp(app, damped, now));
}

export const serpHoldVolatileDetector: ActionDetector = {
  rule: 'serp.hold_volatile',
  detect: detectSerpHoldVolatile,
};
