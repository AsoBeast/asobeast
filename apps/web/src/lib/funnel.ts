import type {
  Store,
  StoreFunnelChange,
  StoreFunnelPoint,
  StoreFunnelReport,
  StoreFunnelWindow,
  StoreFunnelWindowDays,
} from "@asobeast/shared";
import { formatNumber } from "./format";

export const FUNNEL_SERIES_DAYS = 90;
export const FUNNEL_HEADLINE_DAYS: StoreFunnelWindowDays = 28;

export type FunnelState = "off" | "waiting" | "ready";

export interface FunnelTile {
  label: string;
  metric: keyof StoreFunnelChange;
}

export interface FunnelCopy {
  console: string;
  base: string;
  freshness: string;
  connectTitle: string;
  connectBody: string;
  askOwner: string;
  notReporting: string;
  refusedTitle: string;
  refusedBody: string;
  refusedAskOwner: string;
}

const APP_STORE_TILES: FunnelTile[] = [
  { label: "Impressions", metric: "impressions" },
  { label: "Product page views", metric: "pageViews" },
  { label: "Get taps", metric: "gets" },
  { label: "Conversion", metric: "conversion" },
];

const PLAY_TILES: FunnelTile[] = [
  { label: "Store listing visitors", metric: "pageViews" },
  { label: "Acquisitions", metric: "gets" },
  { label: "Conversion", metric: "conversion" },
];

export const FUNNEL_COPY: Record<Store, FunnelCopy> = {
  APP_STORE: {
    console: "App Store Connect",
    base: "impressions",
    freshness:
      "Apple finishes a day within three days; the newest days may still grow.",
    connectTitle:
      "Connect App Store Connect to see impressions and conversion here.",
    connectBody:
      "A key from App Store Connect lets AsoBeast read Apple's own numbers for this app, back to 2024.",
    askOwner: "Ask the workspace owner to connect App Store Connect.",
    notReporting:
      "The connected key sees this app once it belongs to the key's team and Apple has published its first report.",
    refusedTitle: "App Store Connect refused the connected key.",
    refusedBody:
      "The numbers already stored come back once the key is accepted again. Verify it, or connect a new key.",
    refusedAskOwner:
      "Ask the workspace owner to verify the key in Integrations.",
  },
  GOOGLE_PLAY: {
    console: "Google Play Console",
    base: "store listing visitors",
    freshness:
      "Google posts a day three to seven days later; counting changed on July 10, 2026.",
    connectTitle:
      "Connect the Google Play Console to see store listing visitors and conversion here.",
    connectBody:
      "Signing in with Google, or a service account invited in Play Console, lets AsoBeast read Google's own numbers for this app from its monthly report files.",
    askOwner: "Ask the workspace owner to connect the Google Play Console.",
    notReporting:
      "The connection reads this app once Play Console writes its store performance files to the bucket.",
    refusedTitle: "Google Play Console refused the connection.",
    refusedBody:
      "The numbers already stored come back once Google accepts the connection again. Verify it, or reconnect.",
    refusedAskOwner:
      "Ask the workspace owner to verify the Google Play connection in Integrations.",
  },
};

export const funnelTiles = (report: Pick<StoreFunnelReport, "store">) =>
  report.store === "GOOGLE_PLAY" ? PLAY_TILES : APP_STORE_TILES;

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
  const play = report.store === "GOOGLE_PLAY";
  if (play && report.country !== null) return null;
  const base = (counts: StoreFunnelPoint["total"]): number =>
    (play ? counts.pageViews : counts.impressions) ?? 0;
  const inside = report.points.filter(
    (point) => point.date >= window.from && point.date <= window.to,
  );
  const total = inside.reduce((sum, point) => sum + base(point.total), 0);
  if (total === 0) return null;
  const search = inside.reduce((sum, point) => sum + base(point.search), 0);
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
