import { Prisma } from '@prisma/client';
import {
  ACTION_RULE_CATEGORY,
  ActionCategory,
  ActionEvidence,
  ActionItem,
  ActionPriority,
  ActionRule,
  ActionStatus,
  isActionCategory,
  isActionPriority,
  isActionRule,
  isActionStatus,
  Store,
} from '@asobeast/shared';

export interface ActionRow {
  id: string;
  rule: string;
  category: string;
  status: string;
  priority: string;
  impact: number;
  formulaVersion: string;
  country: string;
  store: Store;
  evidence: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  snoozedUntil: Date | null;
  closedAt: Date | null;
  verifiedAt: Date | null;
  reopenCount: number;
  note: string | null;
  aiExplanation: string | null;
  aiModel: string | null;
  aiGeneratedAt: Date | null;
  app: { id: string; name: string | null };
  keyword: { id: string; text: string } | null;
}

export const ROW_SELECT = {
  id: true,
  rule: true,
  category: true,
  status: true,
  priority: true,
  impact: true,
  formulaVersion: true,
  country: true,
  store: true,
  evidence: true,
  firstSeenAt: true,
  lastSeenAt: true,
  resolvedAt: true,
  snoozedUntil: true,
  closedAt: true,
  verifiedAt: true,
  reopenCount: true,
  note: true,
  aiExplanation: true,
  aiModel: true,
  aiGeneratedAt: true,
  app: { select: { id: true, name: true } },
  keyword: { select: { id: true, text: true } },
} satisfies Prisma.ActionItemSelect;

const EVIDENCE_FIELDS: Record<ActionRule, readonly string[]> = {
  'keyword.add_uncovered': ['opportunity', 'indexedFields', 'uncoveredFields'],
  'keyword.defend': ['entrants', 'entrantsAtOrAbove', 'observedDays'],
  'keyword.prune': ['checkedDays', 'rankedDays', 'dailyRequestsSaved'],
  'rank.investigate_drop': ['changedAt', 'fields', 'droppedKeywords'],
  'serp.hold_volatile': ['volatility', 'observedDays', 'dampenedRules'],
  'audit.fix_factor': ['factorId', 'score', 'weight', 'auditDate'],
  'reviews.investigate_theme': ['theme', 'mentions', 'sampleReviewIds'],
  'market.improve_country': ['country', 'homeCountry', 'gap'],
  'keyword.push_to_top10': ['latestPosition', 'daysInBand', 'coveredFields'],
  'metadata.fix_lint': ['field', 'chars', 'limit', 'issues'],
  'rank.investigate_unexplained_drop': [
    'country',
    'visibilityDelta',
    'droppedKeywords',
  ],
  'competitor.investigate_overtake': [
    'competitorAppId',
    'changedAt',
    'fields',
    'keywords',
  ],
  'reviews.investigate_rating_decline': [
    'recentAverage',
    'baselineAverage',
    'drop',
    'sampleReviewIds',
  ],
  'reviews.reply_negative': ['unanswered', 'checked', 'sampleReviewIds'],
};

export function parseActionEvidence(
  rule: string,
  raw: unknown,
): ActionEvidence | null {
  if (!isActionRule(rule)) return null;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const candidate = raw as Record<string, unknown>;
  if (candidate.rule !== rule) return null;
  const required = EVIDENCE_FIELDS[rule];
  if (required.some((field) => candidate[field] === undefined)) return null;
  return candidate as unknown as ActionEvidence;
}

const iso = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

export const priorityOf = (stored: string): ActionPriority =>
  isActionPriority(stored) ? stored : 'low';

function categoryOf(rule: string, stored: string): ActionCategory {
  if (isActionRule(rule)) return ACTION_RULE_CATEGORY[rule];
  return isActionCategory(stored) ? stored : 'hygiene';
}

export function toActionItem(row: ActionRow): ActionItem {
  const evidence = parseActionEvidence(row.rule, row.evidence);
  const rule: ActionRule = isActionRule(row.rule)
    ? row.rule
    : 'keyword.add_uncovered';
  const status: ActionStatus = isActionStatus(row.status) ? row.status : 'OPEN';
  return {
    id: row.id,
    rule,
    category: categoryOf(row.rule, row.category),
    status,
    priority: priorityOf(row.priority),
    impact: row.impact,
    formulaVersion: row.formulaVersion,
    scope: {
      appId: row.app.id,
      appName: row.app.name,
      store: row.store,
      country: row.country,
      keywordId: row.keyword?.id ?? null,
      keywordText: row.keyword?.text ?? null,
    },
    evidence,
    degraded: evidence === null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    resolvedAt: iso(row.resolvedAt),
    snoozedUntil: iso(row.snoozedUntil),
    closedAt: iso(row.closedAt),
    verifiedAt: iso(row.verifiedAt),
    reopenCount: row.reopenCount,
    note: row.note,
    ai: {
      explanation: row.aiExplanation,
      model: row.aiModel,
      generatedAt: iso(row.aiGeneratedAt),
    },
  };
}
