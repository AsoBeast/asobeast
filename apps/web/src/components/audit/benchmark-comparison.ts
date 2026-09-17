import type { AuditBenchmarkRow } from "@asobeast/shared";

export type Comparison = "ahead" | "behind" | "even";

export const COMPARISON_LABEL: Record<Comparison, string> = {
  ahead: "Ahead",
  behind: "Behind",
  even: "Even",
};

export function comparison(row: AuditBenchmarkRow): Comparison {
  if (row.you === null || row.median === null) return "even";
  if (row.you === row.median) return "even";
  const higherIsBetter = row.better === "higher";
  const youLead = row.you > row.median;
  return youLead === higherIsBetter ? "ahead" : "behind";
}
