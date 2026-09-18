import { AuditGrade } from '@asobeast/shared';

export const GRADE_BANDS = [
  { min: 85, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 50, grade: 'C' },
  { min: 30, grade: 'D' },
] as const satisfies readonly { min: number; grade: AuditGrade }[];

export const round1 = (value: number): number => Math.round(value * 10) / 10;
export const round2 = (value: number): number => Math.round(value * 100) / 100;

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

export interface WeightedCheck {
  weight: number;
  score: number | null;
}

export interface FactorConfidence {
  score: number | null;
  confidence: number;
}

export function scoreFactor(checks: WeightedCheck[]): FactorConfidence {
  const listed = sum(checks.map((item) => item.weight));
  const scored = checks.filter(
    (item): item is WeightedCheck & { score: number } => item.score !== null,
  );
  const scoredWeight = sum(scored.map((item) => item.weight));
  if (scoredWeight === 0) {
    return { score: null, confidence: 0 };
  }
  return {
    score: round1(
      sum(scored.map((item) => item.weight * item.score)) / scoredWeight,
    ),
    confidence: scoredWeight / listed,
  };
}

export interface FactorScore {
  weight: number;
  score: number | null;
  confidence: number;
  measurable: boolean;
}

export interface AuditTotals {
  overall: number | null;
  confidence: number;
  coveredWeight: number;
  totalWeight: number;
}

export function scoreAudit(factors: FactorScore[]): AuditTotals {
  const measurable = factors.filter((factor) => factor.measurable);
  const scored = factors.filter(
    (factor): factor is FactorScore & { score: number } =>
      factor.score !== null,
  );
  const denominator = sum(
    scored.map((factor) => factor.weight * factor.confidence),
  );
  const measurableWeight = sum(measurable.map((factor) => factor.weight));
  return {
    overall:
      denominator === 0
        ? null
        : round1(
            (10 *
              sum(
                scored.map(
                  (factor) => factor.weight * factor.confidence * factor.score,
                ),
              )) /
              denominator,
          ),
    confidence:
      measurableWeight === 0
        ? 0
        : round2(
            sum(measurable.map((factor) => factor.weight * factor.confidence)) /
              measurableWeight,
          ),
    coveredWeight: sum(scored.map((factor) => factor.weight)),
    totalWeight: sum(factors.map((factor) => factor.weight)),
  };
}

export function gradeFor(overall: number | null): AuditGrade | null {
  if (overall === null) return null;
  return GRADE_BANDS.find((band) => overall >= band.min)?.grade ?? 'F';
}
