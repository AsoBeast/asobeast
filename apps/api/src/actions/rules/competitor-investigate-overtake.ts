import {
  ActionOvertakenKeyword,
  ChangeField,
  CompetitorInvestigateOvertakeEvidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { coversPhrase } from '../../audit/audit-scoring';
import { overtaken, PositionPair } from '../../rankings/rank-milestones';
import { OPPORTUNITY_MIN_RELEVANCE } from '../../scoring/opportunity';
import {
  ActionCompetitorChange,
  competitorRankingKey,
} from '../action-competitors';
import type {
  ActionContext,
  ActionContextApp,
  ActionRankingDay,
} from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { windowCutoff } from './window';

export const OVERTAKE_WINDOW_DAYS = 14;
export const OVERTAKE_MIN_DAYS_AFTER = 2;
export const OVERTAKE_MIN_VOLUME = 20;
export const OVERTAKE_MIN_RELEVANCE = OPPORTUNITY_MIN_RELEVANCE;
export const OVERTAKE_YOUR_POSITION_MAX = 20;
export const OVERTAKE_MAX_KEYWORDS = 5;
export const OVERTAKE_KEYWORD_PRESSURE_CAP = 3;
export const OVERTAKE_CONFIDENCE_CAPTURES = 7;
export const OVERTAKE_PRESSURE_WEIGHT = 0.6;
export const OVERTAKE_MENTION_WEIGHT = 0.4;

interface CompetitorChangeDay {
  competitorAppId: string;
  competitorName: string | null;
  date: string;
  changes: ActionCompetitorChange[];
}

interface Overtake {
  keyword: ActionOvertakenKeyword;
  capturesAfter: number;
}

const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

function changeDays(
  changes: ActionCompetitorChange[],
  cutoff: string,
): CompetitorChangeDay[] {
  const days = new Map<string, CompetitorChangeDay>();
  for (const change of changes) {
    const date = dayOf(change.capturedAt);
    if (date < cutoff) continue;
    const key = `${change.competitorAppId}~${date}`;
    const day = days.get(key) ?? {
      competitorAppId: change.competitorAppId,
      competitorName: change.competitorName,
      date,
      changes: [],
    };
    day.changes.push(change);
    days.set(key, day);
  }
  return [...days.values()];
}

const latestAfter = (
  changes: ActionCompetitorChange[],
  field: ChangeField,
): string | null =>
  changes
    .filter((change) => change.field === field)
    .sort(
      (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime(),
    )
    .at(-1)?.after ?? null;

const qualifies = (keyword: TrackedKeywordItem, home: string): boolean =>
  keyword.active &&
  keyword.country === home &&
  (keyword.volume ?? 0) >= OVERTAKE_MIN_VOLUME &&
  keyword.relevance !== null &&
  keyword.relevance >= OVERTAKE_MIN_RELEVANCE;

function overtakeOn(
  app: ActionContextApp,
  day: CompetitorChangeDay,
  keyword: TrackedKeywordItem,
  wording: string[],
): Overtake | null {
  const yours = (app.rankingDaysByKeyword.get(keyword.keywordId) ?? [])
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
  const theirs = new Map(
    (
      app.competitorRankingDays.get(
        competitorRankingKey(day.competitorAppId, keyword.keywordId),
      ) ?? []
    ).map((capture: ActionRankingDay) => [capture.date, capture.position]),
  );
  const pairOn = (capture: ActionRankingDay): PositionPair => ({
    app: capture.position,
    competitor: theirs.get(capture.date) ?? null,
  });

  const beforeCapture = yours
    .filter((capture) => capture.date < day.date && capture.position !== null)
    .at(-1);
  const after = yours.filter((capture) => capture.date >= day.date);
  if (!beforeCapture || after.length < OVERTAKE_MIN_DAYS_AFTER) return null;
  const before = pairOn(beforeCapture);
  if (before.app === null || before.app > OVERTAKE_YOUR_POSITION_MAX) {
    return null;
  }
  if (!after.every((capture) => overtaken(before, pairOn(capture)))) {
    return null;
  }

  const latest = pairOn(after[after.length - 1]);
  return {
    keyword: {
      keywordId: keyword.keywordId,
      text: keyword.text,
      yourBefore: before.app,
      yourAfter: latest.app,
      theirBefore: before.competitor,
      theirAfter: latest.competitor,
      volume: keyword.volume,
      mentioned: wording.some((text) => coversPhrase(text, keyword.text)),
    },
    capturesAfter: after.length,
  };
}

const byVolumeThenText = (left: Overtake, right: Overtake): number =>
  (right.keyword.volume ?? 0) - (left.keyword.volume ?? 0) ||
  left.keyword.text.localeCompare(right.keyword.text);

function detectDay(
  app: ActionContextApp,
  day: CompetitorChangeDay,
): DetectedAction | null {
  const newTitle = latestAfter(day.changes, 'title');
  const newSubtitle = latestAfter(day.changes, 'subtitle');
  const wording = [newTitle, newSubtitle].filter(
    (text): text is string => text !== null,
  );
  const kept = app.trackedKeywords
    .filter((keyword) => qualifies(keyword, app.country))
    .map((keyword) => overtakeOn(app, day, keyword, wording))
    .filter((overtake): overtake is Overtake => overtake !== null)
    .sort(byVolumeThenText)
    .slice(0, OVERTAKE_MAX_KEYWORDS);
  if (kept.length === 0) return null;

  const keywords = kept.map((overtake) => overtake.keyword);
  const mentioned = keywords.filter((keyword) => keyword.mentioned).length;
  const evidence: CompetitorInvestigateOvertakeEvidence = {
    rule: 'competitor.investigate_overtake',
    competitorAppId: day.competitorAppId,
    competitorName: day.competitorName,
    changedAt: day.date,
    fields: [...new Set(day.changes.map((change) => change.field))].sort(),
    newTitle,
    newSubtitle,
    keywords,
  };
  return {
    rule: 'competitor.investigate_overtake',
    appId: app.id,
    store: app.store,
    country: app.country,
    keywordId: null,
    discriminator: `${day.competitorAppId}~${day.date}`,
    terms: {
      reach: Math.max(...keywords.map((keyword) => keyword.volume ?? 0)) / 100,
      severity:
        clampUnit(keywords.length / OVERTAKE_KEYWORD_PRESSURE_CAP) *
          OVERTAKE_PRESSURE_WEIGHT +
        (mentioned / keywords.length) * OVERTAKE_MENTION_WEIGHT,
      confidence: clampUnit(
        Math.min(...kept.map((overtake) => overtake.capturesAfter)) /
          OVERTAKE_CONFIDENCE_CAPTURES,
      ),
    },
    evidence,
  };
}

export function detectCompetitorInvestigateOvertake(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  const cutoff = windowCutoff(now, OVERTAKE_WINDOW_DAYS);
  return context.apps.flatMap((app) =>
    changeDays(app.competitorChanges, cutoff)
      .map((day) => detectDay(app, day))
      .filter((detection): detection is DetectedAction => detection !== null),
  );
}

export const competitorInvestigateOvertakeDetector: ActionDetector = {
  rule: 'competitor.investigate_overtake',
  detect: detectCompetitorInvestigateOvertake,
};
