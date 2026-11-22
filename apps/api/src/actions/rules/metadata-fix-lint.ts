import {
  LintSeverity,
  MetadataField,
  MetadataFieldAudit,
  MetadataFixLintEvidence,
} from '@asobeast/shared';
import type { ActionContext, ActionContextApp } from '../action-context';
import { clampUnit } from '../action-impact';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const LINT_ACTION_SEVERITY: LintSeverity = 'error';
export const LINT_FIELD_REACH: Record<MetadataField, number> = {
  title: 0.8,
  subtitle: 0.6,
  shortDescription: 0.6,
  keywordField: 0.5,
  description: 0.3,
  promotionalText: 0.2,
  whatsNew: 0.2,
};
export const LINT_BASE_SEVERITY = 0.6;
export const LINT_SEVERITY_STEP = 0.2;

function actionIssues(
  audit: MetadataFieldAudit,
): MetadataFixLintEvidence['issues'] {
  return audit.issues
    .filter((issue) => issue.severity === LINT_ACTION_SEVERITY)
    .map((issue) => ({
      rule: issue.rule,
      message: issue.message,
      offendingText: issue.offendingText ?? null,
    }));
}

function detectField(
  app: ActionContextApp,
  country: string,
  audit: MetadataFieldAudit,
): DetectedAction | null {
  const issues = actionIssues(audit);
  if (issues.length === 0) return null;

  const evidence: MetadataFixLintEvidence = {
    rule: 'metadata.fix_lint',
    field: audit.field,
    chars: audit.chars,
    limit: audit.limit,
    issues,
  };
  return {
    rule: 'metadata.fix_lint',
    appId: app.id,
    store: app.store,
    country,
    keywordId: null,
    discriminator: audit.field,
    terms: {
      reach: LINT_FIELD_REACH[audit.field],
      severity: clampUnit(
        LINT_BASE_SEVERITY + LINT_SEVERITY_STEP * (issues.length - 1),
      ),
      confidence: 1,
    },
    evidence,
  };
}

function problemKey(audit: MetadataFieldAudit): string {
  const issues = actionIssues(audit).map(
    (issue) => `${issue.rule}~${issue.offendingText ?? ''}`,
  );
  return [audit.field, audit.value ?? '', ...issues].join('~');
}

function detectForApp(app: ActionContextApp): DetectedAction[] {
  const listings = [
    { country: app.country, fields: app.metadataFields },
    ...app.marketMetadata,
  ];
  const reported = new Set<string>();
  const detections: DetectedAction[] = [];
  for (const { country, fields } of listings) {
    for (const audit of fields) {
      const detection = detectField(app, country, audit);
      if (detection === null) continue;
      const key = problemKey(audit);
      if (reported.has(key)) continue;
      reported.add(key);
      detections.push(detection);
    }
  }
  return detections;
}

export function detectMetadataFixLint(
  context: ActionContext,
): DetectedAction[] {
  return context.apps.flatMap(detectForApp);
}

export const metadataFixLintDetector: ActionDetector = {
  rule: 'metadata.fix_lint',
  detect: detectMetadataFixLint,
};
