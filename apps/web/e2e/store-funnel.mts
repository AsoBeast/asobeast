import {
  STORE_FUNNEL_WINDOWS,
  type StoreFunnelCounts,
  type StoreFunnelPoint,
  type StoreFunnelReport,
  type StoreFunnelWindow,
} from "@asobeast/shared";

const COMPLETE_THROUGH = "2026-10-13";
const SERIES_DAYS = 90;
const DAY_MS = 86_400_000;
const LAST_DAY = Date.parse("2026-10-16T00:00:00.000Z");

const counts = (
  impressions: number,
  pageViews: number,
  gets: number,
  conversion: number,
): StoreFunnelCounts => ({
  impressions,
  uniqueImpressions: impressions,
  pageViews,
  gets,
  conversion,
});

const PREVIOUS = counts(11_345, 900, 326, 0.029);

const dayOf = (index: number): string =>
  new Date(LAST_DAY - (SERIES_DAYS - 1 - index) * DAY_MS)
    .toISOString()
    .slice(0, 10);

const points = (impressions: number, search: number): StoreFunnelPoint[] =>
  Array.from({ length: SERIES_DAYS }, (_, index) => {
    const date = dayOf(index);
    return {
      date,
      complete: date <= COMPLETE_THROUGH,
      total: counts(impressions, 40, 3, 0.03),
      search: counts(search, 25, 2, 0.032),
    };
  });

const windowsOf = (
  current: StoreFunnelCounts,
  status: StoreFunnelWindow["status"],
): StoreFunnelWindow[] =>
  STORE_FUNNEL_WINDOWS.map((days) => ({
    days,
    status,
    from: new Date(
      Date.parse(`${COMPLETE_THROUGH}T00:00:00.000Z`) - (days - 1) * DAY_MS,
    )
      .toISOString()
      .slice(0, 10),
    to: COMPLETE_THROUGH,
    current,
    previous: status === "measured" ? PREVIOUS : null,
    change:
      status === "measured"
        ? { impressions: 0.088, pageViews: 0.12, gets: 0.18, conversion: 0.076 }
        : null,
  }));

const report = (
  appId: string,
  overrides: Partial<StoreFunnelReport>,
): StoreFunnelReport => ({
  appId,
  store: "APP_STORE",
  country: null,
  connected: true,
  source: "appStoreConnect",
  days: SERIES_DAYS,
  completeThrough: COMPLETE_THROUGH,
  points: points(100, 62),
  windows: windowsOf(counts(12_345, 1_008, 385, 0.0312), "measured"),
  ...overrides,
});

export const APP_1_FUNNEL = report("app-1", {});

export const APP_1_FUNNEL_PL = report("app-1", {
  country: "pl",
  points: points(20, 10),
  windows: windowsOf(counts(2_100, 180, 42, 0.02), "measured"),
});

export const APP_LONG_FUNNEL = report("app-long", {
  windows: windowsOf(counts(640, 75, 19, 0.0297), "pending"),
});

export const NOT_CONNECTED_FUNNEL = (appId: string): StoreFunnelReport =>
  report(appId, {
    connected: false,
    source: null,
    completeThrough: null,
    points: [],
    windows: [],
  });

export function funnelFor(
  appId: string,
  country: string | null,
): StoreFunnelReport {
  if (appId === "app-1") {
    return country === "pl" ? APP_1_FUNNEL_PL : APP_1_FUNNEL;
  }
  if (appId === "app-long") return APP_LONG_FUNNEL;
  return NOT_CONNECTED_FUNNEL(appId);
}
