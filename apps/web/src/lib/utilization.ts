export const UTILIZATION_WARN = 0.6;
export const UTILIZATION_DANGER = 0.85;

export type UtilizationLevel = "ok" | "warn" | "danger";

export const UTILIZATION_STATUS: Record<UtilizationLevel, string> = {
  ok: "Healthy",
  warn: "High",
  danger: "Over capacity",
};

export function utilizationLevel(utilization: number): UtilizationLevel {
  if (utilization > UTILIZATION_DANGER) return "danger";
  if (utilization > UTILIZATION_WARN) return "warn";
  return "ok";
}

export function utilizationPercent(utilization: number): number {
  return Math.round(utilization * 100);
}
