import type { Store } from "@asobeast/shared";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  formatCountry,
  formatDate,
  formatList,
  storeLabel,
} from "@/lib/format";

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

export function dayRangeLabel(from: string, to: string): string {
  return from === to
    ? `${formatDate(from)} UTC`
    : `${formatDate(from)} to ${formatDate(to)} UTC`;
}

export function buildChartCaption(source: CaptionSource): ChartCaption {
  const storefronts = [...new Set(source.countries)].map(formatCountry);
  const parts = [
    source.appName ?? source.storeAppId,
    storeLabel(source.store),
    ...(storefronts.length > 0 ? [formatList(storefronts)] : []),
    dayRangeLabel(source.from, source.to),
  ];
  return {
    title: source.title,
    subtitle: parts.join(" · "),
    brand: PRODUCT_NAME,
    series: source.series,
  };
}
