import type { AuditCheckStatus, AuditFactorResult } from "@asobeast/shared";

export const CHECK_STATUSES = [
  "pass",
  "warn",
  "fail",
  "unanswered",
] as const satisfies readonly AuditCheckStatus[];

export type CheckCounts = Record<AuditCheckStatus, number>;

export interface CheckSummary {
  counts: CheckCounts;
  total: number;
  factors: number;
}

export function checkSummary(factors: AuditFactorResult[]): CheckSummary {
  const measurable = factors.filter(
    (factor) => factor.availability !== "not-measurable",
  );
  const counts: CheckCounts = { pass: 0, warn: 0, fail: 0, unanswered: 0 };
  for (const factor of measurable) {
    for (const check of factor.checks) counts[check.status] += 1;
  }
  return {
    counts,
    total: CHECK_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    factors: measurable.length,
  };
}
