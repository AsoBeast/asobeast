const UTILIZATION_WARN = 0.6;
const UTILIZATION_DANGER = 0.85;

const FULL = 1;
const PERCENT_MAX = 100;

export type UtilizationLevel = "ok" | "warn" | "danger";

export function utilizationLevel(utilization: number): UtilizationLevel {
  if (utilization > UTILIZATION_DANGER) return "danger";
  if (utilization > UTILIZATION_WARN) return "warn";
  return "ok";
}

export function utilizationStatus(utilization: number): string {
  if (utilization > FULL) return "Over capacity";
  const level = utilizationLevel(utilization);
  if (level === "danger") return "Near capacity";
  return level === "warn" ? "High" : "Healthy";
}

export function utilizationPercent(utilization: number): number {
  return Math.round(utilization * 100);
}

export function meterValue(utilization: number): { now: number; text: string } {
  const percent = utilizationPercent(utilization);
  return { now: Math.min(PERCENT_MAX, percent), text: `${percent}%` };
}
