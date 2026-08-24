import {
  ACTION_ADVISORY_MAX_IMPACT,
  ACTION_ADVISORY_RULES,
  ACTION_IMPACT_WEIGHTS,
  ACTION_PRIORITY_BANDS,
  ActionPriority,
  ActionRule,
} from '@asobeast/shared';

export interface ImpactTerms {
  reach: number;
  severity: number;
  confidence: number;
}

export interface ScoredImpact {
  impact: number;
  priority: ActionPriority;
}

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function priorityFor(impact: number): ActionPriority {
  if (impact >= ACTION_PRIORITY_BANDS.critical) return 'critical';
  if (impact >= ACTION_PRIORITY_BANDS.high) return 'high';
  if (impact >= ACTION_PRIORITY_BANDS.medium) return 'medium';
  return 'low';
}

function requireFinite(
  rule: ActionRule,
  term: keyof ImpactTerms,
  value: number,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(`action impact term ${term} for ${rule} is not finite`);
  }
  return value;
}

export function scoreImpact(
  rule: ActionRule,
  terms: ImpactTerms,
): ScoredImpact {
  const reach = clampUnit(requireFinite(rule, 'reach', terms.reach));
  const severity = clampUnit(requireFinite(rule, 'severity', terms.severity));
  const confidence = clampUnit(
    requireFinite(rule, 'confidence', terms.confidence),
  );

  const weighted =
    100 *
    (ACTION_IMPACT_WEIGHTS.reach * reach +
      ACTION_IMPACT_WEIGHTS.severity * severity +
      ACTION_IMPACT_WEIGHTS.confidence * confidence);

  const raw = ACTION_ADVISORY_RULES.includes(rule)
    ? Math.min(weighted, ACTION_ADVISORY_MAX_IMPACT)
    : weighted;

  const impact = Math.round(raw);
  return { impact, priority: priorityFor(impact) };
}
