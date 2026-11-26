import type { Locale } from "./locale";

const formatters = new Map<string, Intl.NumberFormat>();

export function formatFixedNumberInLocale(
  value: number,
  digits: number,
  locale: Locale,
): string {
  const key = `${locale}:${digits}`;
  const cached = formatters.get(key);
  if (cached) return cached.format(value);
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
  formatters.set(key, formatter);
  return formatter.format(value);
}
