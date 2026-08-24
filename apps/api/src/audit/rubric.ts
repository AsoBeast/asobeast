import {
  AppAuditResult,
  AuditCheckResult,
  AuditFactorResult,
  AuditRecommendation,
  AuditRecommendations,
} from '@asobeast/shared';
import { AuditContext } from './audit-scoring';
import {
  conversionChecks,
  descriptionChecks,
  iconChecks,
  keywordFieldChecks,
  previewVideoChecks,
  rankingChecks,
  ratingChecks,
  screenshotChecks,
  subtitleChecks,
  titleChecks,
} from './audit-checks';

export const AUDIT_WEIGHTS = {
  APP_STORE: {
    title: 20,
    subtitle: 15,
    keywordField: 15,
    description: 5,
    screenshots: 15,
    previewVideo: 5,
    ratings: 15,
    icon: 5,
    rankings: 10,
    conversion: 5,
  },
  GOOGLE_PLAY: {
    title: 20,
    subtitle: 0,
    keywordField: 0,
    description: 15,
    screenshots: 15,
    previewVideo: 5,
    ratings: 15,
    icon: 5,
    rankings: 10,
    conversion: 5,
  },
} as const;

type FactorId = keyof (typeof AUDIT_WEIGHTS)['APP_STORE'];
type RecommendationBucket = keyof AuditRecommendations;

interface FactorDefinition {
  id: FactorId;
  label: string;
  bucket: RecommendationBucket;
  build: (context: AuditContext) => AuditCheckResult[] | null;
}

const FACTORS: FactorDefinition[] = [
  { id: 'title', label: 'Title', bucket: 'quickWins', build: titleChecks },
  {
    id: 'subtitle',
    label: 'Subtitle',
    bucket: 'quickWins',
    build: subtitleChecks,
  },
  {
    id: 'keywordField',
    label: 'Keyword field',
    bucket: 'quickWins',
    build: keywordFieldChecks,
  },
  {
    id: 'description',
    label: 'Description',
    bucket: 'quickWins',
    build: descriptionChecks,
  },
  {
    id: 'screenshots',
    label: 'Screenshots',
    bucket: 'highImpact',
    build: screenshotChecks,
  },
  {
    id: 'previewVideo',
    label: 'Preview video',
    bucket: 'highImpact',
    build: previewVideoChecks,
  },
  {
    id: 'ratings',
    label: 'Ratings & reviews',
    bucket: 'strategic',
    build: ratingChecks,
  },
  { id: 'icon', label: 'Icon', bucket: 'highImpact', build: iconChecks },
  {
    id: 'rankings',
    label: 'Keyword rankings',
    bucket: 'strategic',
    build: rankingChecks,
  },
  {
    id: 'conversion',
    label: 'Conversion signals',
    bucket: 'strategic',
    build: conversionChecks,
  },
];

const FACTOR_BUCKET = new Map<string, RecommendationBucket>(
  FACTORS.map((factor) => [factor.id, factor.bucket]),
);

export const AUDIT_FACTOR_LABELS: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(FACTORS.map((factor) => [factor.id, factor.label])),
  );

const round1 = (value: number): number => Math.round(value * 10) / 10;

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const SEVERITY = { fail: 2, warn: 1, pass: 0, unanswered: 0 } as const;

export function computeAudit(context: AuditContext): AppAuditResult {
  const weights = AUDIT_WEIGHTS[context.store];
  const factors: AuditFactorResult[] = [];

  for (const definition of FACTORS) {
    const weight = weights[definition.id];
    if (weight === 0) {
      continue;
    }
    const checks = definition.build(context) ?? [];
    const scored = checks.filter(
      (item): item is AuditCheckResult & { score: number } =>
        item.score !== null,
    );
    const score =
      scored.length === 0
        ? null
        : round1(mean(scored.map((item) => item.score)));
    factors.push({
      id: definition.id,
      label: definition.label,
      weight,
      score,
      checks,
      needsInput: score === null,
    });
  }

  let weightedSum = 0;
  let coveredWeight = 0;
  let totalWeight = 0;
  for (const factor of factors) {
    totalWeight += factor.weight;
    if (factor.score !== null) {
      weightedSum += factor.score * factor.weight;
      coveredWeight += factor.weight;
    }
  }
  const overall =
    coveredWeight === 0 ? null : round1((weightedSum / coveredWeight) * 10);

  return {
    appId: context.appId,
    store: context.store,
    overall,
    coveredWeight,
    totalWeight,
    factors,
    recommendations: deriveRecommendations(factors),
    ai: context.aiStatus,
    generatedAt: context.now.toISOString(),
  };
}

export function deriveRecommendations(
  factors: AuditFactorResult[],
): AuditRecommendations {
  const ranked: Array<{
    rec: AuditRecommendation;
    bucket: RecommendationBucket;
    rank: number;
  }> = [];

  for (const factor of factors) {
    const bucket = FACTOR_BUCKET.get(factor.id) ?? 'strategic';
    for (const item of factor.checks) {
      const severity = SEVERITY[item.status];
      if (severity === 0) {
        continue;
      }
      ranked.push({
        rec: {
          factorId: factor.id,
          checkId: item.id,
          label: item.label,
          detail: item.detail,
        },
        bucket,
        rank: factor.weight * severity,
      });
    }
  }

  ranked.sort((a, b) => b.rank - a.rank);

  const recommendations: AuditRecommendations = {
    quickWins: [],
    highImpact: [],
    strategic: [],
  };
  for (const entry of ranked) {
    recommendations[entry.bucket].push(entry.rec);
  }
  return recommendations;
}
