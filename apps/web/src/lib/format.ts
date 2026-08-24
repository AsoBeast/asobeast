import {
  formatRankPosition,
  type PlanLimit,
  type Store,
} from "@asobeast/shared";

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
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  dateStyle: "medium",
  timeStyle: "short",
});
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

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPlanLimit(value: PlanLimit): string {
  return value === null ? "Unlimited" : numberFormatter.format(value);
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

export function formatPrice(value: number): string {
  return value === 0 ? "Free" : priceFormatter.format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDayMonth(value: string): string {
  return dayMonthFormatter.format(new Date(value));
}

export function formatDateTime(value: string): string {
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}

export function formatRelativeTime(value: string, now = Date.now()): string {
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
  const upper = code.toUpperCase();
  try {
    return countryNames.of(upper) ?? upper;
  } catch {
    return upper;
  }
}
