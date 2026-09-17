import {
  AuditEffort,
  AuditImpact,
  AuditRecommendation,
  AuditRecommendations,
  AuditTarget,
} from '@asobeast/shared';
import { FactorScore, round1, scoreAudit, scoreFactor } from './audit-engine';
import { AuditCheckId, RubricCheck } from './audit-scoring';

export const HIGH_IMPACT_LIFT = 3;
export const MEDIUM_IMPACT_LIFT = 1;
export const HIGH_IMPACT_MIN_LIFT = 1;

export const CHECK_EFFORT: Record<AuditCheckId, AuditEffort> = {
  'title-keyword': 'minutes',
  'title-length': 'minutes',
  'title-policy': 'minutes',
  'title-uniqueness': 'minutes',
  'subtitle-keyword': 'minutes',
  'subtitle-no-repetition': 'minutes',
  'subtitle-length': 'minutes',
  'keyword-field-saved': 'minutes',
  'keyword-field-hygiene': 'minutes',
  'keyword-field-bytes': 'minutes',
  'keyword-field-relevance': 'minutes',
  'short-description-keyword': 'minutes',
  'short-description-length': 'minutes',
  'short-description-no-repetition': 'minutes',
  'short-description-policy': 'minutes',
  'description-hook': 'minutes',
  'description-cta': 'minutes',
  'description-social-proof': 'minutes',
  'description-formatting': 'minutes',
  'description-keyword-coverage': 'minutes',
  'description-keyword-frequency': 'minutes',
  'description-above-fold': 'minutes',
  'screenshots-count': 'hours',
  'screenshots-ipad': 'hours',
  'screenshots-feature-graphic': 'hours',
  'screenshots-captions': 'hours',
  'screenshots-first-message': 'hours',
  'screenshots-caption-keywords': 'hours',
  'screenshots-consistency': 'hours',
  'screenshots-localized': 'hours',
  'preview-video-present': 'weeks',
  'ratings-average': 'weeks',
  'ratings-volume': 'weeks',
  'ratings-recent': 'weeks',
  'ratings-current-version': 'weeks',
  'ratings-responses': 'hours',
  'icon-no-text': 'hours',
  'icon-simplicity': 'hours',
  'icon-contrast': 'hours',
  'icon-distinct': 'hours',
  'rankings-visibility': 'weeks',
  'rankings-top10': 'weeks',
  'rankings-trend': 'weeks',
  'rankings-competitor-gap': 'weeks',
  'conversion-update-recency': 'weeks',
  'conversion-release-notes': 'hours',
  'conversion-localizations': 'weeks',
  'conversion-privacy-policy': 'minutes',
};

export const CHECK_TARGET: Record<AuditCheckId, AuditTarget> = {
  'title-keyword': 'metadata',
  'title-length': 'metadata',
  'title-policy': 'metadata',
  'title-uniqueness': 'metadata',
  'subtitle-keyword': 'metadata',
  'subtitle-no-repetition': 'metadata',
  'subtitle-length': 'metadata',
  'keyword-field-saved': 'keywords',
  'keyword-field-hygiene': 'keywords',
  'keyword-field-bytes': 'keywords',
  'keyword-field-relevance': 'keywords',
  'short-description-keyword': 'metadata',
  'short-description-length': 'metadata',
  'short-description-no-repetition': 'metadata',
  'short-description-policy': 'metadata',
  'description-hook': 'metadata',
  'description-cta': 'metadata',
  'description-social-proof': 'metadata',
  'description-formatting': 'metadata',
  'description-keyword-coverage': 'metadata',
  'description-keyword-frequency': 'metadata',
  'description-above-fold': 'metadata',
  'screenshots-count': 'store-console',
  'screenshots-ipad': 'store-console',
  'screenshots-feature-graphic': 'store-console',
  'screenshots-captions': 'store-console',
  'screenshots-first-message': 'store-console',
  'screenshots-caption-keywords': 'store-console',
  'screenshots-consistency': 'store-console',
  'screenshots-localized': 'store-console',
  'preview-video-present': 'store-console',
  'ratings-average': 'reviews',
  'ratings-volume': 'reviews',
  'ratings-recent': 'reviews',
  'ratings-current-version': 'reviews',
  'ratings-responses': 'reviews',
  'icon-no-text': 'store-console',
  'icon-simplicity': 'store-console',
  'icon-contrast': 'store-console',
  'icon-distinct': 'store-console',
  'rankings-visibility': 'rankings',
  'rankings-top10': 'rankings',
  'rankings-trend': 'rankings',
  'rankings-competitor-gap': 'competitors',
  'conversion-update-recency': 'store-console',
  'conversion-release-notes': 'store-console',
  'conversion-localizations': 'store-console',
  'conversion-privacy-policy': 'store-console',
};

export const impactFor = (lift: number): AuditImpact =>
  lift >= HIGH_IMPACT_LIFT
    ? 'high'
    : lift >= MEDIUM_IMPACT_LIFT
      ? 'medium'
      : 'low';

export const bucketFor = (
  effort: AuditEffort,
  lift: number,
): keyof AuditRecommendations =>
  effort === 'minutes'
    ? 'quickWins'
    : effort === 'hours' && lift >= HIGH_IMPACT_MIN_LIFT
      ? 'highImpact'
      : 'strategic';

export interface RubricFactor {
  id: string;
  weight: number;
  checks: RubricCheck[];
}

export interface AuditPlan {
  recommendations: AuditRecommendations;
  potential: number | null;
}

const RAISED_SCORE = 10;

const factorScore = (
  factor: RubricFactor,
  raised: Set<string>,
): FactorScore => {
  const checks = factor.checks.map((item) =>
    raised.has(item.id) ? { ...item, score: RAISED_SCORE } : item,
  );
  const { score, confidence } = scoreFactor(checks);
  return {
    weight: factor.weight,
    score,
    confidence,
    measurable: factor.checks.length > 0,
  };
};

const overallWith = (
  factors: RubricFactor[],
  raised: Set<string>,
): number | null =>
  scoreAudit(factors.map((factor) => factorScore(factor, raised))).overall;

const emptyBuckets = (): AuditRecommendations => ({
  quickWins: [],
  highImpact: [],
  strategic: [],
});

export function buildRecommendations(
  factors: RubricFactor[],
  overall: number | null,
): AuditPlan {
  if (overall === null) {
    return { recommendations: emptyBuckets(), potential: null };
  }

  const advised = factors.flatMap((factor) =>
    factor.checks
      .filter((item) => item.advice !== null)
      .map((item) => ({ factor, item })),
  );

  const ranked = advised.map(({ factor, item }) => {
    const raised = overallWith(factors, new Set([item.id]));
    const lift = Math.max(0, round1((raised ?? overall) - overall));
    const effort = CHECK_EFFORT[item.id];
    const recommendation: AuditRecommendation = {
      factorId: factor.id,
      checkId: item.id,
      label: item.advice!.title,
      detail: item.detail,
      fix: item.advice!.fix,
      effort,
      impact: impactFor(lift),
      lift,
      target: CHECK_TARGET[item.id],
    };
    return {
      recommendation,
      bucket: bucketFor(effort, lift),
      weight: factor.weight,
    };
  });

  ranked.sort(
    (a, b) =>
      (b.recommendation.lift ?? 0) - (a.recommendation.lift ?? 0) ||
      b.weight - a.weight ||
      a.recommendation.checkId.localeCompare(b.recommendation.checkId),
  );

  const recommendations = emptyBuckets();
  for (const entry of ranked) {
    recommendations[entry.bucket].push(entry.recommendation);
  }

  return {
    recommendations,
    potential: overallWith(
      factors,
      new Set(advised.map(({ item }) => item.id)),
    ),
  };
}
