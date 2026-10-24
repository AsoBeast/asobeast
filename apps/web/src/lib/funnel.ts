import type {
  StoreFunnelChange,
  StoreFunnelReport,
  StoreFunnelWindow,
  StoreFunnelWindowDays,
} from "@asobeast/shared";
import { formatNumber } from "./format";

export const FUNNEL_SERIES_DAYS = 90;
export const FUNNEL_HEADLINE_DAYS: StoreFunnelWindowDays = 28;

export type FunnelState = "off" | "waiting" | "ready";

const PERCENT = 100;

export function windowOf(
  report: StoreFunnelReport,
  days: StoreFunnelWindowDays,
): StoreFunnelWindow | null {
  return report.windows.find((window) => window.days === days) ?? null;
}

export function formatCount(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

export function formatConversion(value: number | null): string {
  return value === null ? "—" : `${(value * PERCENT).toFixed(1)}%`;
}

export function searchShare(
  report: StoreFunnelReport,
  window: StoreFunnelWindow | null,
): number | null {
  if (!window) return null;
  const inside = report.points.filter(
    (point) => point.date >= window.from && point.date <= window.to,
  );
  const total = inside.reduce(
    (sum, point) => sum + (point.total.impressions ?? 0),
    0,
  );
  if (total === 0) return null;
  const search = inside.reduce(
    (sum, point) => sum + (point.search.impressions ?? 0),
    0,
  );
  return Math.round((search / total) * PERCENT);
}

export function trendValue(
  window: StoreFunnelWindow | null,
  metric: keyof StoreFunnelChange,
): number | null {
  const change = window?.status === "measured" ? window.change?.[metric] : null;
  return change === null || change === undefined
    ? null
    : Math.round(change * PERCENT);
}

export function funnelState(report: StoreFunnelReport): FunnelState {
  if (!report.connected) return "off";
  return report.windows.some((window) => window.current !== null)
    ? "ready"
    : "waiting";
}
