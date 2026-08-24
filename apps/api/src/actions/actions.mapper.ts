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
  reopenCount: number;
  note: string | null;
  aiExplanation: string | null;
  aiModel: string | null;
  aiGeneratedAt: Date | null;
  app: { id: string; name: string | null };
  keyword: { id: string; text: string } | null;
}

const EVIDENCE_FIELDS: Record<ActionRule, readonly string[]> = {
  'keyword.add_uncovered': ['opportunity', 'indexedFields', 'uncoveredFields'],
  'keyword.defend': ['entrants', 'entrantsAtOrAbove', 'observedDays'],
  'keyword.prune': ['checkedDays', 'rankedDays', 'dailyRequestsSaved'],
  'rank.investigate_drop': ['changedAt', 'fields', 'droppedKeywords'],
  'serp.hold_volatile': ['volatility', 'observedDays', 'dampenedRules'],
  'audit.fix_factor': ['factorId', 'score', 'weight', 'auditDate'],
  'reviews.investigate_theme': ['theme', 'mentions', 'sampleReviewIds'],
  'market.improve_country': ['country', 'homeCountry', 'gap'],
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
  const priority: ActionPriority = isActionPriority(row.priority)
    ? row.priority
    : 'low';

  return {
    id: row.id,
    rule,
    category: categoryOf(row.rule, row.category),
    status,
    priority,
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
    reopenCount: row.reopenCount,
    note: row.note,
    ai: {
      explanation: row.aiExplanation,
      model: row.aiModel,
      generatedAt: iso(row.aiGeneratedAt),
    },
  };
}
