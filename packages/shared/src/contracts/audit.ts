import { Store } from '../index';

export type AuditCheckKind = 'auto' | 'heuristic' | 'ai';
export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'unanswered';

export type AuditGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type AuditGroupId = 'discoverability' | 'conversion';

export type AuditCheckSource =
  'store' | 'keywords' | 'competitors' | 'reviews' | 'rankings' | 'ai';

export type AuditUnlockKind =
  | 'ai-analysis'
  | 'keyword-field'
  | 'keywords'
  | 'competitors'
  | 'history'
  | 'reviews';

export type AuditFactorAvailability =
  'measured' | 'partial' | 'awaiting-input' | 'not-measurable';

export type AuditEffort = 'minutes' | 'hours' | 'weeks';

export type AuditImpact = 'high' | 'medium' | 'low';

export type AuditTarget =
  | 'metadata'
  | 'keywords'
  | 'competitors'
  | 'reviews'
  | 'rankings'
  | 'store-console'
  | 'ai-analysis';

export type AuditAiRunState = 'queued' | 'running' | 'completed' | 'failed';

export type AuditScreenshotMessage =
  'benefit' | 'feature' | 'social-proof' | 'ui-only' | 'onboarding' | 'other';

export type AuditBenchmarkMetric =
  | 'rating-average'
  | 'rating-count'
  | 'screenshots'
  | 'has-video'
  | 'title-length'
  | 'subtitle-length'
  | 'days-since-update';

export interface AuditUnlock {
  kind: AuditUnlockKind;
  label: string;
}

export interface AuditUnlockSummary extends AuditUnlock {
  checks: number;
}

export interface AuditGroupResult {
  id: AuditGroupId;
  label: string;
  score: number | null;
  confidence: number;
}

export interface AuditLimitation {
  id: string;
  label: string;
  detail: string;
}

export interface AuditAiRun {
  state: AuditAiRunState;
  requestedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface AuditAiRunResult extends AuditAiRun {
  reused: boolean;
}

export interface AuditIconObservation {
  url: string;
  hasText: boolean;
  elementCount: 'one' | 'two' | 'three-or-more';
  contrast: 'high' | 'medium' | 'low';
  similarCompetitor: {
    appId: string;
    name: string | null;
    iconUrl: string;
  } | null;
}

export interface AuditScreenshotObservation {
  position: number;
  url: string;
  captionText: string | null;
  captionReadable: boolean;
  captionLanguage: string | null;
  message: AuditScreenshotMessage;
  keywordHits: string[];
}

export interface AuditCreative {
  analyzedAt: string;
  model: string;
  stale: boolean;
  icon: AuditIconObservation | null;
  screenshots: AuditScreenshotObservation[];
}

export interface AuditBenchmarkRow {
  metric: AuditBenchmarkMetric;
  label: string;
  better: 'higher' | 'lower';
  you: number | null;
  median: number | null;
  best: number | null;
  bestAppId: string | null;
}

export interface AuditBenchmarks {
  competitors: number;
  rows: AuditBenchmarkRow[];
}

export interface AuditCheckResult {
  id: string;
  label: string;
  kind: AuditCheckKind;
  status: AuditCheckStatus;
  score: number | null;
  detail: string;
  weight?: number;
  source?: AuditCheckSource;
  unlock?: AuditUnlock | null;
}

export interface AuditFactorResult {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  checks: AuditCheckResult[];
  needsInput: boolean;
  group?: AuditGroupId;
  confidence?: number;
  availability?: AuditFactorAvailability;
}

export interface AuditRecommendation {
  factorId: string;
  checkId: string;
  label: string;
  detail: string;
  fix?: string;
  effort?: AuditEffort;
  impact?: AuditImpact;
  lift?: number;
  target?: AuditTarget;
}

export interface AuditRecommendations {
  quickWins: AuditRecommendation[];
  highImpact: AuditRecommendation[];
  strategic: AuditRecommendation[];
}

export interface AuditAiStatus {
  configured: boolean;
  model: string | null;
  generatedAt: string | null;
  stale?: boolean;
  run?: AuditAiRun | null;
}

export interface AppAuditResult {
  appId: string;
  store: Store;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
  factors: AuditFactorResult[];
  recommendations: AuditRecommendations;
  ai: AuditAiStatus;
  generatedAt: string;
  rubricVersion?: string;
  grade?: AuditGrade | null;
  confidence?: number;
  potential?: number | null;
  groups?: AuditGroupResult[];
  limitations?: AuditLimitation[];
  unlocks?: AuditUnlockSummary[];
  creative?: AuditCreative | null;
  benchmarks?: AuditBenchmarks | null;
}

export interface AuditScorePoint {
  date: string;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
  rubricVersion?: string;
  confidence?: number | null;
}

export interface AuditHistory {
  points: AuditScorePoint[];
}
