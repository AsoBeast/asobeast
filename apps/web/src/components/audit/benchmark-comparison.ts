import type { AuditBenchmarkRow } from "@asobeast/shared";

export type Comparison = "ahead" | "behind" | "even" | "unknown";

export const COMPARISON_LABEL: Record<Comparison, string> = {
  ahead: "Ahead",
  behind: "Behind",
  even: "Even",
  unknown: "No data",
};

export function comparison(row: AuditBenchmarkRow): Comparison {
  if (row.you === null || row.median === null) return "unknown";
  if (row.you === row.median) return "even";
  const higherIsBetter = row.better === "higher";
  const youLead = row.you > row.median;
  return youLead === higherIsBetter ? "ahead" : "behind";
}

export function benchmarkRatio(row: AuditBenchmarkRow): number {
  const { you, best } = row;
  if (you === null || best === null) return 0;
  const [value, target] = row.better === "higher" ? [you, best] : [best, you];
  if (target === 0) return 1;
  return Math.max(0, Math.min(1, value / target));
}
