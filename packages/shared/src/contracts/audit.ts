import { Store } from '../index';

export type AuditCheckKind = 'auto' | 'heuristic' | 'ai';
export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'unanswered';

export interface AuditCheckResult {
  id: string;
  label: string;
  kind: AuditCheckKind;
  status: AuditCheckStatus;
  score: number | null;
  detail: string;
}

export interface AuditFactorResult {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  checks: AuditCheckResult[];
  needsInput: boolean;
}

export interface AuditRecommendation {
  factorId: string;
  checkId: string;
  label: string;
  detail: string;
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
}

export interface AuditScorePoint {
  date: string;
  overall: number | null;
  coveredWeight: number;
  totalWeight: number;
}

export interface AuditHistory {
  points: AuditScorePoint[];
}
