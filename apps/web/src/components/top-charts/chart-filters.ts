import {
  chartDevicesOf,
  DEFAULT_COUNTRY,
  OVERALL_GENRE,
  type ChartCompareWindow,
  type ChartKey,
  type Store,
} from "@asobeast/shared";

export function activeFilterCount(
  chart: Pick<ChartKey, "country" | "genre">,
  compare: ChartCompareWindow,
): number {
  return [
    chart.country !== DEFAULT_COUNTRY,
    chart.genre !== OVERALL_GENRE,
    compare !== "1d",
  ].filter(Boolean).length;
}

export function showsDevice(store: Store): boolean {
  return chartDevicesOf(store).length > 1;
}
