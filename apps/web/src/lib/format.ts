import {
  CURRENCY_PATTERN,
  formatRankPosition,
  type PlanLimit,
  type Store,
} from "@asobeast/shared";
import { COUNTRY_NAMES, COUNTRY_NAMES_ZH } from "./country-names";
import type { Locale } from "./locale";

const numberFormatters = new Map<Locale, Intl.NumberFormat>();

function numberFormatter(locale: Locale = "en"): Intl.NumberFormat {
  const cached = numberFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale);
  numberFormatters.set(locale, formatter);
  return formatter;
}

const measureFormatters = new Map<Locale, Intl.NumberFormat>();

function measureFormatterIn(locale: Locale): Intl.NumberFormat {
  const cached = measureFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });
  measureFormatters.set(locale, formatter);
  return formatter;
}

export const MEASURE_DIGITS = 1;

const fixedMeasureFormatters = new Map<Locale, Intl.NumberFormat>();

function fixedMeasureFormatterIn(locale: Locale): Intl.NumberFormat {
  const cached = fixedMeasureFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: MEASURE_DIGITS,
    maximumFractionDigits: MEASURE_DIGITS,
    signDisplay: "negative",
  });
  fixedMeasureFormatters.set(locale, formatter);
  return formatter;
}

const compactFormatters = new Map<Locale, Intl.NumberFormat>();

function compactFormatterIn(locale: Locale): Intl.NumberFormat {
  const cached = compactFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  compactFormatters.set(locale, formatter);
  return formatter;
}
const zonedDateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatterIn(
  timeZone: string,
  locale: Locale = "en",
): Intl.DateTimeFormat {
  const key = `${locale}:${timeZone}`;
  const cached = zonedDateFormatters.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  zonedDateFormatters.set(key, formatter);
  return formatter;
}

const dayMonthFormatters = new Map<Locale, Intl.DateTimeFormat>();

function dayMonthFormatterIn(locale: Locale): Intl.DateTimeFormat {
  const cached = dayMonthFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  dayMonthFormatters.set(locale, formatter);
  return formatter;
}

const monthFormatters = new Map<Locale, Intl.DateTimeFormat>();

function monthFormatterIn(locale: Locale): Intl.DateTimeFormat {
  const cached = monthFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  monthFormatters.set(locale, formatter);
  return formatter;
}
const bareAmountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const currencyFormatters = new Map<string, Intl.NumberFormat>();
const WHOLE_CURRENCIES = new Set([
  "AFN",
  "ALL",
  "BIF",
  "BYR",
  "CLP",
  "COP",
  "DJF",
  "GNF",
  "HUF",
  "IDR",
  "IQD",
  "IRR",
  "ISK",
  "JPY",
  "KMF",
  "KPW",
  "KRW",
  "LAK",
  "LBP",
  "MGA",
  "MMK",
  "PKR",
  "PYG",
  "RSD",
  "RWF",
  "SLL",
  "SOS",
  "SYP",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
  "YER",
]);
const THOUSANDTHS_CURRENCIES = new Set([
  "BHD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);
const listFormatters = new Map<Locale, Intl.ListFormat>();

function listFormatter(locale: Locale): Intl.ListFormat {
  const cached = listFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.ListFormat(locale, { type: "conjunction" });
  listFormatters.set(locale, formatter);
  return formatter;
}

const relativeTimeFormatters = new Map<Locale, Intl.RelativeTimeFormat>();

function relativeTimeFormatter(locale: Locale): Intl.RelativeTimeFormat {
  const cached = relativeTimeFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  relativeTimeFormatters.set(locale, formatter);
  return formatter;
}
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

const STORE_SHORT_LABELS: Record<Store, string> = {
  APP_STORE: "iOS",
  GOOGLE_PLAY: "Play",
};

const countryNames: ReadonlyMap<string, string> = new Map(
  Object.entries(COUNTRY_NAMES),
);
const countryNamesZh: ReadonlyMap<string, string> = new Map(
  Object.entries(COUNTRY_NAMES_ZH),
);

export function formatNumber(value: number): string {
  return numberFormatter("en").format(value);
}

export function formatNumberInLocale(value: number, locale: Locale): string {
  return numberFormatter(locale).format(value);
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function formatPlanLimit(value: PlanLimit): string {
  return value === null ? "Unlimited" : formatNumber(value);
}

export function formatList(values: readonly string[]): string {
  return listFormatter("en").format(values);
}

export function formatListInLocale(
  values: readonly string[],
  locale: Locale,
): string {
  return listFormatter(locale).format(values);
}

export function formatMeasure(value: number): string {
  return measureFormatterIn("en").format(value);
}

export function formatMeasureInLocale(value: number, locale: Locale): string {
  return measureFormatterIn(locale).format(value);
}

export function formatMeasureFixed(value: number): string {
  return fixedMeasureFormatterIn("en").format(value);
}

export function formatMeasureFixedInLocale(
  value: number,
  locale: Locale,
): string {
  return fixedMeasureFormatterIn(locale).format(value);
}

const roundingFormatters = new Map<number, Intl.NumberFormat>();

function roundingFormatter(digits: number): Intl.NumberFormat {
  const cached = roundingFormatters.get(digits);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
  roundingFormatters.set(digits, formatter);
  return formatter;
}

export function roundAsShown(value: number, digits: number): number {
  return Number(roundingFormatter(digits).format(value));
}

export { formatFixedNumberInLocale } from "./format-number";

const isWholeMeasure = (value: number): boolean =>
  formatMeasureFixed(value).endsWith(".0");

export function formatMeasurePair(
  before: number,
  after: number,
): [string, string] {
  return formatMeasurePairInLocale(before, after, "en");
}

export function formatMeasurePairInLocale(
  before: number,
  after: number,
  locale: Locale,
): [string, string] {
  const format =
    isWholeMeasure(before) && isWholeMeasure(after)
      ? (value: number) => formatMeasureInLocale(value, locale)
      : (value: number) => formatMeasureFixedInLocale(value, locale);
  return [format(before), format(after)];
}

export function formatCompact(value: number): string {
  return compactFormatterIn("en").format(value);
}

export function formatCompactInLocale(value: number, locale: Locale): string {
  return compactFormatterIn(locale).format(value);
}

export function formatRating(value: number): string {
  return formatRatingInLocale(value, "en");
}

export function formatRatingInLocale(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(value);
}

function fractionDigits(currency: string): number {
  if (WHOLE_CURRENCIES.has(currency)) return 0;
  return THOUSANDTHS_CURRENCIES.has(currency) ? 3 : 2;
}

function currencyFormatter(currency: string): Intl.NumberFormat {
  const known = currencyFormatters.get(currency);
  if (known) return known;
  const digits = fractionDigits(currency);
  const created = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  currencyFormatters.set(currency, created);
  return created;
}

export function formatUsd(value: number): string {
  return currencyFormatter("USD").format(value);
}

export function formatPrice(
  value: number,
  currency?: string | null,
  freeLabel = "Free",
): string {
  if (value === 0) return freeLabel;
  return currency != null && CURRENCY_PATTERN.test(currency)
    ? currencyFormatter(currency).format(value)
    : bareAmountFormatter.format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return dateFormatterIn("UTC", "en").format(new Date(value));
}

export function formatDateInLocale(
  value: string | null,
  locale: Locale,
): string {
  if (!value) return "—";
  return dateFormatterIn("UTC", locale).format(new Date(value));
}

export function formatDateIn(instant: Date, timeZone: string): string {
  return dateFormatterIn(timeZone, "en").format(instant);
}

export function formatDateInZoneAndLocale(
  instant: Date,
  timeZone: string,
  locale: Locale,
): string {
  return dateFormatterIn(timeZone, locale).format(instant);
}

export function formatDayMonth(value: string): string {
  return dayMonthFormatterIn("en").format(new Date(value));
}

export function formatDayMonthInLocale(value: string, locale: Locale): string {
  return dayMonthFormatterIn(locale).format(new Date(value));
}

export function formatMonth(value: string): string {
  return monthFormatterIn("en").format(new Date(value));
}

export function formatMonthInLocale(value: string, locale: Locale): string {
  return monthFormatterIn(locale).format(new Date(value));
}

function formatClock(instant: Date, locale: Locale): string {
  const hours = instant.getUTCHours();
  const minutes = String(instant.getUTCMinutes()).padStart(2, "0");
  if (locale === "zh-CN") {
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

export function formatUtcClock(value: string): string {
  return `${formatClock(new Date(value), "en")} UTC`;
}

export function formatUtcClockInLocale(value: string, locale: Locale): string {
  return `${formatClock(new Date(value), locale)} UTC`;
}

export function formatDateTime(value: string): string {
  const instant = new Date(value);
  return `${dateFormatterIn("UTC", "en").format(instant)}, ${formatClock(instant, "en")} UTC`;
}

export function formatDateTimeInLocale(value: string, locale: Locale): string {
  const instant = new Date(value);
  const separator = locale === "zh-CN" ? " " : ", ";
  return `${dateFormatterIn("UTC", locale).format(instant)}${separator}${formatClock(instant, locale)} UTC`;
}

export function formatRelativeTime(value: string, now: number): string {
  const diff = new Date(value).getTime() - now;
  const magnitude = Math.abs(diff);
  const formatter = relativeTimeFormatter("en");
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (magnitude >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(Math.round(diff / 1000), "second");
}

export function formatRelativeTimeInLocale(
  value: string,
  now: number,
  locale: Locale,
): string {
  const diff = new Date(value).getTime() - now;
  const magnitude = Math.abs(diff);
  const formatter = relativeTimeFormatter(locale);
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (magnitude >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(Math.round(diff / 1000), "second");
}

export function formatCategoryPosition(value: number | null): string {
  return formatRankPosition(value);
}

export function storeLabel(store: Store): string {
  return STORE_LABELS[store];
}

export function storeShortLabel(store: Store): string {
  return STORE_SHORT_LABELS[store];
}

export function formatCountry(code: string): string {
  return countryNames.get(code.toLowerCase()) ?? code.toUpperCase();
}

export function formatCountryInLocale(code: string, locale: Locale): string {
  const names = locale === "zh-CN" ? countryNamesZh : countryNames;
  return names.get(code.toLowerCase()) ?? code.toUpperCase();
}
