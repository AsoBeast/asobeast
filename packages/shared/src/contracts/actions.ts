import type { ScoreProvenance } from './keywords';
import type { AuditCheckStatus } from './audit';
import type { ChangeField } from './changes';
import type { MetadataField } from '../aso/limits';
import type { Store } from '../index';

export const ACTION_RULES = [
  'keyword.add_uncovered',
  'keyword.defend',
  'keyword.prune',
  'rank.investigate_drop',
  'serp.hold_volatile',
  'audit.fix_factor',
  'reviews.investigate_theme',
  'market.improve_country',
  'keyword.push_to_top10',
  'metadata.fix_lint',
] as const;
export type ActionRule = (typeof ACTION_RULES)[number];

export const ACTION_CATEGORIES = [
  'metadata',
  'competition',
  'regression',
  'conversion',
  'reputation',
  'markets',
  'hygiene',
] as const;
export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

export const ACTION_STATUSES = [
  'OPEN',
  'SNOOZED',
  'DONE',
  'DISMISSED',
  'RESOLVED',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_RULE_CATEGORY: Record<ActionRule, ActionCategory> = {
  'keyword.add_uncovered': 'metadata',
  'keyword.defend': 'competition',
  'keyword.prune': 'hygiene',
  'rank.investigate_drop': 'regression',
  'serp.hold_volatile': 'hygiene',
  'audit.fix_factor': 'conversion',
  'reviews.investigate_theme': 'reputation',
  'market.improve_country': 'markets',
  'keyword.push_to_top10': 'metadata',
  'metadata.fix_lint': 'metadata',
};

export const isActionRule = (value: unknown): value is ActionRule =>
  typeof value === 'string' && ACTION_RULES.some((rule) => rule === value);

export const isActionStatus = (value: unknown): value is ActionStatus =>
  typeof value === 'string' && ACTION_STATUSES.some((s) => s === value);

export const isActionPriority = (value: unknown): value is ActionPriority =>
  typeof value === 'string' && ACTION_PRIORITIES.some((p) => p === value);

export const isActionCategory = (value: unknown): value is ActionCategory =>
  typeof value === 'string' && ACTION_CATEGORIES.some((c) => c === value);

export const ACTION_FORMULA_VERSION = 'actions-v1';

export const ACTION_IMPACT_WEIGHTS = {
  reach: 0.45,
  severity: 0.35,
  confidence: 0.2,
} as const;

export const ACTION_PRIORITY_BANDS = {
  critical: 80,
  high: 60,
  medium: 35,
} as const;

export const ACTION_ADVISORY_MAX_IMPACT = 50;

export const ACTION_ADVISORY_RULES: readonly ActionRule[] = [
  'serp.hold_volatile',
  'keyword.prune',
];

export interface ActionScope {
  appId: string;
  appName: string | null;
  store: Store;
  country: string;
  keywordId: string | null;
  keywordText: string | null;
}

export interface KeywordAddUncoveredEvidence {
  rule: 'keyword.add_uncovered';
  opportunity: number;
  traffic: number | null;
  difficulty: number | null;
  volume: number | null;
  relevance: number | null;
  latestPosition: number | null;
  indexedFields: MetadataField[];
  uncoveredFields: MetadataField[];
  keywordFieldCharsFree: number | null;
  scoreProvenance: ScoreProvenance | null;
}

export interface ActionSerpEntrant {
  storeAppId: string;
  title: string;
  position: number;
  appId: string | null;
  isCompetitor: boolean;
}

export interface KeywordDefendEvidence {
  rule: 'keyword.defend';
  yourPosition: number | null;
  previousPosition: number | null;
  windowDays: number;
  observedDays: number;
  volatility: number | null;
  entrants: ActionSerpEntrant[];
  entrantsAtOrAbove: number;
  volume: number | null;
}

export interface KeywordPruneEvidence {
  rule: 'keyword.prune';
  observedDays: number;
  checkedDays: number;
  rankedDays: number;
  bestPosition: number | null;
  volume: number | null;
  traffic: number | null;
  relevance: number | null;
  dailyRequestsSaved: number;
  budgetUtilization: number;
}

export interface ActionDroppedKeyword {
  keywordId: string;
  text: string;
  from: number | null;
  to: number | null;
}

export interface RankInvestigateDropEvidence {
  rule: 'rank.investigate_drop';
  changedAt: string;
  fields: ChangeField[];
  visibilityBefore: number | null;
  visibilityAfter: number | null;
  visibilityDelta: number | null;
  windowDays: number;
  trackedKeywords: number;
  droppedKeywords: ActionDroppedKeyword[];
  meanVolatility: number | null;
}

export interface SerpHoldVolatileEvidence {
  rule: 'serp.hold_volatile';
  volatility: number;
  windowDays: number;
  observedDays: number;
  yourPosition: number | null;
  dampenedRules: ActionRule[];
}

export interface ActionFailingCheck {
  id: string;
  label: string;
  status: AuditCheckStatus;
  score: number | null;
}

export interface AuditFixFactorEvidence {
  rule: 'audit.fix_factor';
  factorId: string;
  factorLabel: string;
  score: number;
  weight: number;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
  auditDate: string;
  failingChecks: ActionFailingCheck[];
}

export interface ReviewsInvestigateThemeEvidence {
  rule: 'reviews.investigate_theme';
  theme: string;
  version: string | null;
  previousVersion: string | null;
  mentions: number;
  previousMentions: number;
  negativeReviews: number;
  totalReviews: number;
  ratingAvgDelta: number | null;
  sampleReviewIds: string[];
}

export interface MarketImproveCountryEvidence {
  rule: 'market.improve_country';
  country: string;
  homeCountry: string;
  marketVisibility: number;
  homeVisibility: number;
  gap: number;
  trackedKeywords: number;
  rankedKeywords: number;
  observedDays: number;
  windowDays: number;
}

export interface KeywordPushToTop10Evidence {
  rule: 'keyword.push_to_top10';
  latestPosition: number;
  bestPosition: number;
  daysInBand: number;
  windowDays: number;
  volume: number | null;
  relevance: number | null;
  opportunity: number | null;
  coveredFields: MetadataField[];
  strongFields: MetadataField[];
}

export interface MetadataFixLintIssue {
  rule: string;
  message: string;
  offendingText: string | null;
}

export interface MetadataFixLintEvidence {
  rule: 'metadata.fix_lint';
  field: MetadataField;
  chars: number;
  limit: number;
  issues: MetadataFixLintIssue[];
}

export type ActionEvidence =
  | KeywordAddUncoveredEvidence
  | KeywordDefendEvidence
  | KeywordPruneEvidence
  | RankInvestigateDropEvidence
  | SerpHoldVolatileEvidence
  | AuditFixFactorEvidence
  | ReviewsInvestigateThemeEvidence
  | MarketImproveCountryEvidence
  | KeywordPushToTop10Evidence
  | MetadataFixLintEvidence;

export interface ActionAi {
  explanation: string | null;
  model: string | null;
  generatedAt: string | null;
}

export interface ActionItem {
  id: string;
  rule: ActionRule;
  category: ActionCategory;
  status: ActionStatus;
  priority: ActionPriority;
  impact: number;
  formulaVersion: string;
  scope: ActionScope;
  evidence: ActionEvidence | null;
  degraded: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  snoozedUntil: string | null;
  closedAt: string | null;
  verifiedAt: string | null;
  reopenCount: number;
  note: string | null;
  ai: ActionAi;
}

export const ACTION_EVENT_TYPES = [
  'opened',
  'reopened',
  'snoozed',
  'woke',
  'done',
  'dismissed',
  'resolved',
  'verified',
] as const;
export type ActionEventType = (typeof ACTION_EVENT_TYPES)[number];

export const isActionEventType = (value: unknown): value is ActionEventType =>
  typeof value === 'string' &&
  ACTION_EVENT_TYPES.some((type) => type === value);

export const ACTION_EVENT_ACTORS = ['system', 'user'] as const;
export type ActionEventActor = (typeof ACTION_EVENT_ACTORS)[number];

export const ACTION_DISMISS_REASONS = [
  'not_relevant',
  'handled_elsewhere',
  'disagree_with_data',
] as const;
export type ActionDismissReason = (typeof ACTION_DISMISS_REASONS)[number];

export const isActionDismissReason = (
  value: unknown,
): value is ActionDismissReason =>
  typeof value === 'string' &&
  ACTION_DISMISS_REASONS.some((reason) => reason === value);

export interface ActionEventItem {
  id: string;
  type: ActionEventType;
  actor: ActionEventActor;
  actorName: string | null;
  occurredAt: string;
  status: ActionStatus;
  priority: ActionPriority;
  impact: number;
  snoozedUntil: string | null;
  reason: ActionDismissReason | null;
}

export const ACTION_TREND_METRICS = [
  'position',
  'visibility',
  'audit',
  'rating',
  'updateAge',
] as const;
export type ActionTrendMetric = (typeof ACTION_TREND_METRICS)[number];

export type ActionTrendDirection = 'lower_is_better' | 'higher_is_better';

export interface ActionTrendPoint {
  date: string;
  checked: boolean;
  value: number | null;
}

export interface ActionTrend {
  metric: ActionTrendMetric;
  direction: ActionTrendDirection;
  depth: number | null;
  points: ActionTrendPoint[];
}

export const ACTION_OUTCOME_VERDICTS = [
  'improved',
  'worsened',
  'unchanged',
  'pending',
] as const;
export type ActionOutcomeVerdict = (typeof ACTION_OUTCOME_VERDICTS)[number];

export interface ActionOutcome {
  metric: ActionTrendMetric;
  direction: ActionTrendDirection;
  before: number | null;
  beforeDate: string | null;
  after: number | null;
  afterDate: string | null;
  change: number | null;
  verdict: ActionOutcomeVerdict;
}

export interface ActionDetail extends ActionItem {
  events: ActionEventItem[];
  trend: ActionTrend | null;
  outcome: ActionOutcome | null;
}

export interface ActionActivityCounts {
  opened: number;
  reopened: number;
  done: number;
  dismissed: number;
  resolved: number;
  verified: number;
}

export interface ActionActivityDay extends ActionActivityCounts {
  date: string;
}

export interface ActionActivity {
  from: string;
  to: string;
  days: ActionActivityDay[];
  totals: ActionActivityCounts;
}

export interface ActionListResult {
  items: ActionItem[];
  total: number;
  generatedAt: string | null;
}

export interface ActionPriorityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ActionSummary {
  open: number;
  snoozed: number;
  byPriority: ActionPriorityCounts;
  byCategory: Record<ActionCategory, number>;
  topRules: Array<{ rule: ActionRule; count: number }>;
  generatedAt: string | null;
  suppressedByCap: number;
  openByPriority: ActionPriorityCounts;
  byStatus: Record<ActionStatus, number>;
}

export type ActionUpdateStatus = Extract<
  ActionStatus,
  'OPEN' | 'SNOOZED' | 'DONE' | 'DISMISSED'
>;

export const ACTION_UPDATE_STATUSES: readonly ActionUpdateStatus[] = [
  'OPEN',
  'SNOOZED',
  'DONE',
  'DISMISSED',
];

export interface ActionUpdateRequest {
  status: ActionUpdateStatus;
  snoozedUntil?: string;
  note?: string;
  reason?: ActionDismissReason;
  revert?: boolean;
}

export interface ActionBulkUpdateRequest {
  ids: string[];
  status: ActionUpdateStatus;
  snoozedUntil?: string;
  reason?: ActionDismissReason;
  revert?: boolean;
}

export interface ActionBulkUpdateResult {
  items: ActionItem[];
  missing: string[];
  conflicts: string[];
}

export interface ActionRunResult {
  queued: true;
  jobId: string;
}

export interface ActionExplanation {
  explanation: string;
  model: string;
  generatedAt: string;
}

export interface ActionAiStatus {
  configured: boolean;
  model: string | null;
}

export interface ActionOpenedPayload {
  event: 'action.opened';
  occurredAt: string;
  app: { id: string; name: string | null; store: Store; country: string };
  action: {
    id: string;
    rule: ActionRule;
    category: ActionCategory;
    priority: ActionPriority;
    impact: number;
    firstSeenAt: string;
    reopened: boolean;
  };
  keyword: { id: string; text: string } | null;
  evidence: ActionEvidence;
  link: string | null;
}
