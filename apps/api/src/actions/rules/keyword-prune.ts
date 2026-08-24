import { KeywordPruneEvidence, TrackedKeywordItem } from '@asobeast/shared';
import type {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { detectKeywordAddUncovered } from './keyword-add-uncovered';

export const PRUNE_MIN_OBSERVED_DAYS = 30;
export const PRUNE_MAX_RANKED_RATIO = 0.05;
export const PRUNE_MAX_VOLUME = 20;
export const PRUNE_MAX_RELEVANCE = 50;
export const PRUNE_UTILIZATION_FLOOR = 0.5;
export const PRUNE_KEYWORD_FLOOR = 50;
export const PRUNE_MAX_PER_APP = 5;
export const PRUNE_DAILY_REQUESTS_SAVED = 1;

interface PruneHistory {
  checkedDays: number;
  rankedDays: number;
  bestPosition: number | null;
}

function summarize(days: ActionRankingDay[]): PruneHistory {
  let rankedDays = 0;
  let bestPosition: number | null = null;
  for (const day of days) {
    if (day.position === null) continue;
    rankedDays += 1;
    if (bestPosition === null || day.position < bestPosition) {
      bestPosition = day.position;
    }
  }
  return { checkedDays: days.length, rankedDays, bestPosition };
}

function eligible(keyword: TrackedKeywordItem): boolean {
  return (
    keyword.active &&
    (keyword.volume ?? 0) < PRUNE_MAX_VOLUME &&
    keyword.relevance !== null &&
    keyword.relevance <= PRUNE_MAX_RELEVANCE
  );
}

function pruningWouldHelp(app: ActionContextApp, utilization: number): boolean {
  if (utilization >= PRUNE_UTILIZATION_FLOOR) return true;
  const active = app.trackedKeywords.filter((keyword) => keyword.active).length;
  return active > PRUNE_KEYWORD_FLOOR;
}

function detectForApp(
  app: ActionContextApp,
  utilization: number,
  claimed: Set<string>,
): DetectedAction[] {
  if (!pruningWouldHelp(app, utilization)) return [];

  const detections: DetectedAction[] = [];
  for (const keyword of app.trackedKeywords) {
    if (claimed.has(`${app.id}:${keyword.keywordId}`)) continue;
    if (!eligible(keyword)) continue;

    const history = summarize(
      app.rankingDaysByKeyword.get(keyword.keywordId) ?? [],
    );
    if (history.checkedDays < PRUNE_MIN_OBSERVED_DAYS) continue;
    if (history.rankedDays / history.checkedDays > PRUNE_MAX_RANKED_RATIO)
      continue;

    const evidence: KeywordPruneEvidence = {
      rule: 'keyword.prune',
      observedDays: history.checkedDays,
      checkedDays: history.checkedDays,
      rankedDays: history.rankedDays,
      bestPosition: history.bestPosition,
      volume: keyword.volume,
      traffic: keyword.traffic,
      relevance: keyword.relevance,
      dailyRequestsSaved: PRUNE_DAILY_REQUESTS_SAVED,
      budgetUtilization: utilization,
    };

    detections.push({
      rule: 'keyword.prune',
      appId: app.id,
      store: app.store,
      country: keyword.country,
      keywordId: keyword.keywordId,
      discriminator: null,
      terms: {
        reach: utilization,
        severity: 1 - history.rankedDays / history.checkedDays,
        confidence: history.checkedDays / PRUNE_MIN_OBSERVED_DAYS,
      },
      evidence,
    });
  }

  return detections
    .sort(
      (left, right) =>
        right.terms.severity - left.terms.severity ||
        (left.keywordId ?? '').localeCompare(right.keywordId ?? ''),
    )
    .slice(0, PRUNE_MAX_PER_APP);
}

export function detectKeywordPrune(context: ActionContext): DetectedAction[] {
  const claimed = new Set(
    detectKeywordAddUncovered(context)
      .filter((detection) => detection.keywordId !== null)
      .map((detection) => `${detection.appId}:${detection.keywordId}`),
  );
  const utilization = context.budget.utilization;
  return context.apps.flatMap((app) => detectForApp(app, utilization, claimed));
}

export const keywordPruneDetector: ActionDetector = {
  rule: 'keyword.prune',
  detect: (context) => detectKeywordPrune(context),
};
