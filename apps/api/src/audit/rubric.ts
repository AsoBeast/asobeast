import { Store } from '@prisma/client';
import {
  AppAuditResult,
  AuditCheckResult,
  AuditFactorAvailability,
  AuditFactorResult,
  AuditGroupId,
  AuditGroupResult,
  AuditRecommendation,
  AuditRecommendations,
  AuditUnlockKind,
  AuditUnlockSummary,
} from '@asobeast/shared';
import { FactorScore, gradeFor, scoreAudit, scoreFactor } from './audit-engine';
import { limitationsFor } from './audit-limitations';
import { AuditContext, RubricCheck } from './audit-scoring';
import { conversionChecks } from './checks/conversion-checks';
import {
  iconChecks,
  previewVideoChecks,
  screenshotChecks,
} from './checks/creative-checks';
import {
  descriptionChecks,
  keywordFieldChecks,
  subtitleChecks,
  titleChecks,
} from './checks/metadata-checks';
import { ratingChecks } from './checks/reputation-checks';
import { rankingChecks } from './checks/visibility-checks';

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

export const AUDIT_RUBRIC_VERSION = 'v2';

export const AUDIT_GROUP_LABELS: Readonly<Record<AuditGroupId, string>> =
  Object.freeze({
    discoverability: 'Search visibility',
    conversion: 'Conversion',
  });

type FactorId = keyof (typeof AUDIT_WEIGHTS)['APP_STORE'];
type RecommendationBucket = keyof AuditRecommendations;

const discoverability = (): AuditGroupId => 'discoverability';
const conversion = (): AuditGroupId => 'conversion';

interface FactorDefinition {
  id: FactorId;
  label: string;
  bucket: RecommendationBucket;
  group: (store: Store) => AuditGroupId;
  build: (context: AuditContext) => RubricCheck[];
}

const FACTORS: FactorDefinition[] = [
  {
    id: 'title',
    label: 'Title',
    bucket: 'quickWins',
    group: discoverability,
    build: titleChecks,
  },
  {
    id: 'subtitle',
    label: 'Subtitle',
    bucket: 'quickWins',
    group: discoverability,
    build: subtitleChecks,
  },
  {
    id: 'keywordField',
    label: 'Keyword field',
    bucket: 'quickWins',
    group: discoverability,
    build: keywordFieldChecks,
  },
  {
    id: 'description',
    label: 'Description',
    bucket: 'quickWins',
    group: (store) =>
      store === Store.GOOGLE_PLAY ? 'discoverability' : 'conversion',
    build: descriptionChecks,
  },
  {
    id: 'screenshots',
    label: 'Screenshots',
    bucket: 'highImpact',
    group: conversion,
    build: screenshotChecks,
  },
  {
    id: 'previewVideo',
    label: 'Preview video',
    bucket: 'highImpact',
    group: conversion,
    build: previewVideoChecks,
  },
  {
    id: 'ratings',
    label: 'Ratings & reviews',
    bucket: 'strategic',
    group: conversion,
    build: ratingChecks,
  },
  {
    id: 'icon',
    label: 'Icon',
    bucket: 'highImpact',
    group: conversion,
    build: iconChecks,
  },
  {
    id: 'rankings',
    label: 'Keyword rankings',
    bucket: 'strategic',
    group: discoverability,
    build: rankingChecks,
  },
  {
    id: 'conversion',
    label: 'Conversion signals',
    bucket: 'strategic',
    group: conversion,
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

const SEVERITY = { fail: 2, warn: 1, pass: 0, unanswered: 0 } as const;

const availabilityOf = (
  checks: RubricCheck[],
  confidence: number,
): AuditFactorAvailability => {
  if (checks.length === 0) return 'not-measurable';
  if (confidence === 0) return 'awaiting-input';
  return confidence === 1 ? 'measured' : 'partial';
};

const toContractCheck = (item: RubricCheck): AuditCheckResult => ({
  id: item.id,
  label: item.label,
  kind: item.kind,
  status: item.status,
  score: item.score,
  detail: item.detail,
  weight: item.weight,
  source: item.source,
  unlock: item.unlock,
});

interface UnlockWeight {
  label: string;
  checks: number;
  weight: number;
}

const deriveUnlocks = (
  factors: { weight: number; checks: RubricCheck[] }[],
): AuditUnlockSummary[] => {
  const totals = new Map<AuditUnlockKind, UnlockWeight>();
  for (const factor of factors) {
    const listed = factor.checks.reduce((sum, item) => sum + item.weight, 0);
    for (const item of factor.checks) {
      if (item.status !== 'unanswered' || !item.unlock) {
        continue;
      }
      const found = totals.get(item.unlock.kind) ?? {
        label: item.unlock.label,
        checks: 0,
        weight: 0,
      };
      totals.set(item.unlock.kind, {
        label: found.label,
        checks: found.checks + 1,
        weight: found.weight + (factor.weight * item.weight) / listed,
      });
    }
  }
  return [...totals]
    .sort(([, a], [, b]) => b.weight - a.weight)
    .map(([kind, entry]) => ({
      kind,
      label: entry.label,
      checks: entry.checks,
    }));
};

const toFactorScore = (factor: AuditFactorResult): FactorScore => ({
  weight: factor.weight,
  score: factor.score,
  confidence: factor.confidence ?? 0,
  measurable: factor.availability !== 'not-measurable',
});

export function computeAudit(context: AuditContext): AppAuditResult {
  const weights = AUDIT_WEIGHTS[context.store];
  const factors: AuditFactorResult[] = [];

  const built: { weight: number; checks: RubricCheck[] }[] = [];

  for (const definition of FACTORS) {
    const weight = weights[definition.id];
    if (weight === 0) {
      continue;
    }
    const checks = definition.build(context);
    built.push({ weight, checks });
    const { score, confidence } = scoreFactor(checks);
    factors.push({
      id: definition.id,
      label: definition.label,
      weight,
      score,
      checks: checks.map(toContractCheck),
      needsInput: score === null,
      group: definition.group(context.store),
      confidence,
      availability: availabilityOf(checks, confidence),
    });
  }

  const totals = scoreAudit(factors.map(toFactorScore));
  const groups: AuditGroupResult[] = (
    Object.keys(AUDIT_GROUP_LABELS) as AuditGroupId[]
  ).map((id) => {
    const members = factors.filter((factor) => factor.group === id);
    const scored = scoreAudit(members.map(toFactorScore));
    return {
      id,
      label: AUDIT_GROUP_LABELS[id],
      score: scored.overall === null ? null : scored.overall / 10,
      confidence: scored.confidence,
    };
  });

  return {
    appId: context.appId,
    store: context.store,
    overall: totals.overall,
    coveredWeight: totals.coveredWeight,
    totalWeight: totals.totalWeight,
    factors,
    recommendations: deriveRecommendations(factors),
    ai: context.aiStatus,
    generatedAt: context.now.toISOString(),
    rubricVersion: AUDIT_RUBRIC_VERSION,
    grade: gradeFor(totals.overall),
    confidence: totals.confidence,
    groups,
    limitations: [...limitationsFor(context.store)],
    unlocks: deriveUnlocks(built),
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
