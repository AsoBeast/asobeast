import { ActionFailingCheck, AuditFixFactorEvidence } from '@asobeast/shared';
import type {
  ActionAuditFactor,
  ActionAuditSnapshot,
  ActionContext,
  ActionContextApp,
} from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { windowCutoff } from './window';

export const AUDIT_WEAK_SCORE = 5;
export const AUDIT_MIN_WEIGHT = 10;
export const AUDIT_MAX_SNAPSHOT_AGE_DAYS = 7;
export const AUDIT_MAX_FACTOR_SCORE = 10;

function isFresh(snapshot: ActionAuditSnapshot, now: Date): boolean {
  return snapshot.date >= windowCutoff(now, AUDIT_MAX_SNAPSHOT_AGE_DAYS);
}

function isWeak(factor: ActionAuditFactor): factor is ActionAuditFactor & {
  score: number;
} {
  return (
    factor.weight >= AUDIT_MIN_WEIGHT &&
    factor.score !== null &&
    factor.score < AUDIT_WEAK_SCORE
  );
}

function failingChecks(factor: ActionAuditFactor): ActionFailingCheck[] {
  return factor.checks
    .filter((check) => check.status === 'fail' || check.status === 'warn')
    .map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      score: check.score,
    }));
}

function detectForApp(app: ActionContextApp, now: Date): DetectedAction[] {
  const snapshot = app.audit;
  if (!snapshot || !isFresh(snapshot, now)) return [];
  if (snapshot.totalWeight <= 0) return [];

  return snapshot.factors.filter(isWeak).map((factor): DetectedAction => {
    const evidence: AuditFixFactorEvidence = {
      rule: 'audit.fix_factor',
      factorId: factor.id,
      factorLabel: factor.label,
      score: factor.score,
      weight: factor.weight,
      overall: snapshot.overall,
      coveredWeight: snapshot.coveredWeight,
      totalWeight: snapshot.totalWeight,
      auditDate: snapshot.date,
      failingChecks: failingChecks(factor),
    };

    return {
      rule: 'audit.fix_factor',
      appId: app.id,
      store: app.store,
      country: app.country,
      keywordId: null,
      discriminator: factor.id,
      terms: {
        reach: factor.weight / snapshot.totalWeight,
        severity:
          (AUDIT_MAX_FACTOR_SCORE - factor.score) / AUDIT_MAX_FACTOR_SCORE,
        confidence: snapshot.coveredWeight / snapshot.totalWeight,
      },
      evidence,
    };
  });
}

export function detectAuditFixFactor(
  context: ActionContext,
  now: Date,
): DetectedAction[] {
  return context.apps.flatMap((app) => detectForApp(app, now));
}

export const auditFixFactorDetector: ActionDetector = {
  rule: 'audit.fix_factor',
  detect: detectAuditFixFactor,
};
