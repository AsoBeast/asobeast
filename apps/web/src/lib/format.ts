import {
  formatRankPosition,
  type PlanLimit,
  type Store,
} from "@asobeast/shared";
import { COUNTRY_NAMES } from "./country-names";

const numberFormatter = new Intl.NumberFormat("en-US");
const measureFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});
const dayMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const listFormatter = new Intl.ListFormat("en-US", { type: "conjunction" });
const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const STORE_LABELS: Record<Store, string> = {
  APP_STORE: "App Store",
  GOOGLE_PLAY: "Google Play",
};

const countryNames: ReadonlyMap<string, string> = new Map(
  Object.entries(COUNTRY_NAMES),
);

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${numberFormatter.format(count)} ${count === 1 ? singular : plural}`;
}

export function formatPlanLimit(value: PlanLimit): string {
  return value === null ? "Unlimited" : numberFormatter.format(value);
}

export function formatList(values: readonly string[]): string {
  return listFormatter.format(values);
}

export function formatMeasure(value: number): string {
  return measureFormatter.format(value);
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

export function formatRating(value: number): string {
  return value.toFixed(1);
}

export function formatUsd(value: number): string {
  return priceFormatter.format(value);
}

export function formatPrice(value: number): string {
  return value === 0 ? "Free" : formatUsd(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDayMonth(value: string): string {
  return dayMonthFormatter.format(new Date(value));
}

function formatClock(instant: Date): string {
  const hours = instant.getUTCHours();
  const minutes = String(instant.getUTCMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

export function formatDateTime(value: string): string {
  const instant = new Date(value);
  return `${dateFormatter.format(instant)}, ${formatClock(instant)} UTC`;
}

export function formatRelativeTime(value: string, now: number): string {
  const diff = new Date(value).getTime() - now;
  const magnitude = Math.abs(diff);
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (magnitude >= ms) {
      return relativeTimeFormatter.format(Math.round(diff / ms), unit);
    }
  }
  return relativeTimeFormatter.format(Math.round(diff / 1000), "second");
}

export function formatCategoryPosition(value: number | null): string {
  return formatRankPosition(value);
}

export function storeLabel(store: Store): string {
  return STORE_LABELS[store];
}

export function formatCountry(code: string): string {
  return countryNames.get(code.toLowerCase()) ?? code.toUpperCase();
}
