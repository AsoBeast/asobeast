import type { Store } from "@asobeast/shared";
import { PRODUCT_NAME } from "@/lib/brand";
import enFormat from "../../../messages/en/format.json";
import zhFormat from "../../../messages/zh-CN/format.json";
import { formatMessage } from "@/i18n/format-message";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatListInLocale,
  storeLabel,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";

const DATE_RANGE_LABELS = {
  en: enFormat.dateRange,
  "zh-CN": zhFormat.dateRange,
} as const;

export interface CaptionSeries {
  label: string;
  color: string;
  dash: string | undefined;
}

export interface ChartCaption {
  title: string;
  subtitle: string;
  brand: string;
  series: CaptionSeries[];
}

export interface CaptionSource {
  title: string;
  appName: string | null;
  storeAppId: string;
  store: Store;
  countries: readonly string[];
  from: string;
  to: string;
  series: CaptionSeries[];
}

export function dayRangeLabel(
  from: string,
  to: string,
  locale: Locale = "en",
): string {
  const labels = DATE_RANGE_LABELS[locale];
  return from === to
    ? formatMessage(labels.sameDay, locale, {
        date: formatDateInLocale(from, locale),
      })
    : formatMessage(labels.span, locale, {
        from: formatDateInLocale(from, locale),
        to: formatDateInLocale(to, locale),
      });
}

export function buildChartCaption(
  source: CaptionSource,
  locale: Locale = "en",
): ChartCaption {
  const storefronts = [...new Set(source.countries)].map((country) =>
    formatCountryInLocale(country, locale),
  );
  const parts = [
    source.appName ?? source.storeAppId,
    storeLabel(source.store),
    ...(storefronts.length > 0
      ? [formatListInLocale(storefronts, locale)]
      : []),
    dayRangeLabel(source.from, source.to, locale),
  ];
  return {
    title: source.title,
    subtitle: parts.join(" · "),
    brand: PRODUCT_NAME,
    series: source.series,
  };
}
