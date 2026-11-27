import type {
  Store,
  StoreFunnelChange,
  StoreFunnelPoint,
  StoreFunnelReport,
  StoreFunnelWindow,
  StoreFunnelWindowDays,
} from "@asobeast/shared";
import enOverview from "../../messages/en/overview.json";
import { formatMessage } from "@/i18n/format-message";
import type { MessageTranslator, TranslationContext } from "@/i18n/translator";
import type { Locale } from "./locale";
import {
  formatMeasureFixedInLocale,
  formatMonthInLocale,
  formatNumberInLocale,
} from "./format";

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

function messageAt(messages: unknown, key: string): string {
  let value = messages;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null || !(part in value)) {
      return key;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : key;
}

const englishTranslator: MessageTranslator = (key, values) =>
  formatMessage(messageAt(enOverview, key), "en", values);

export const FUNNEL_GETS_LABEL: Record<Store, string> = {
  APP_STORE: enOverview.funnel.tiles.gets.appStore,
  GOOGLE_PLAY: enOverview.funnel.tiles.gets.googlePlay,
};

const STORE_COPY_KEY: Record<Store, string> = {
  APP_STORE: "appStore",
  GOOGLE_PLAY: "googlePlay",
};

export function funnelCopy(
  store: Store,
  translator: MessageTranslator,
): FunnelCopy {
  const prefix = `funnel.copy.${STORE_COPY_KEY[store]}`;
  return {
    console: translator(`${prefix}.console`),
    base: translator(`${prefix}.base`),
    freshness: translator(`${prefix}.freshness`),
    connectTitle: translator(`${prefix}.connectTitle`),
    connectBody: translator(`${prefix}.connectBody`),
    askOwner: translator(`${prefix}.askOwner`),
    notReporting: translator(`${prefix}.notReporting`),
    refusedTitle: translator(`${prefix}.refusedTitle`),
    refusedBody: translator(`${prefix}.refusedBody`),
    refusedAskOwner: translator(`${prefix}.refusedAskOwner`),
  };
}

export function funnelGetsLabel(
  store: Store,
  translator: MessageTranslator,
): string {
  return translator(
    `funnel.tiles.gets.${store === "APP_STORE" ? "appStore" : "googlePlay"}`,
  );
}

export function refusalBody(
  store: Store,
  reason: string | null,
  isOwner: boolean,
  translator: MessageTranslator,
): string {
  const copy = funnelCopy(store, translator);
  if (isOwner) return reason ?? copy.refusedBody;
  return reason
    ? translator("funnel.memberRefusal", {
        reason,
        askOwner: copy.refusedAskOwner,
      })
    : copy.refusedAskOwner;
}

export const funnelTiles = (
  report: Pick<StoreFunnelReport, "store">,
  translator: MessageTranslator = englishTranslator,
) =>
  report.store === "GOOGLE_PLAY"
    ? ([
        {
          label: translator("funnel.tiles.playVisitors"),
          metric: "pageViews",
        },
        { label: funnelGetsLabel("GOOGLE_PLAY", translator), metric: "gets" },
        { label: translator("funnel.tiles.conversion"), metric: "conversion" },
      ] as const)
    : ([
        {
          label: translator("funnel.tiles.impressions"),
          metric: "impressions",
        },
        { label: translator("funnel.tiles.pageViews"), metric: "pageViews" },
        { label: funnelGetsLabel("APP_STORE", translator), metric: "gets" },
        { label: translator("funnel.tiles.conversion"), metric: "conversion" },
      ] as const);

const PERCENT = 100;

export function windowOf(
  report: StoreFunnelReport,
  days: StoreFunnelWindowDays,
): StoreFunnelWindow | null {
  return report.windows.find((window) => window.days === days) ?? null;
}

export function funnelTrend(
  report: StoreFunnelReport,
  metric: keyof StoreFunnelChange,
  days: number,
): number[] {
  const values = report.points
    .filter((point) => point.complete)
    .slice(-days)
    .map((point) => point.total[metric]);
  return values.every((value) => value !== null) ? values : [];
}

export function formatCount(
  value: number | null,
  locale: Locale = "en",
): string {
  return value === null ? "—" : formatNumberInLocale(value, locale);
}

export function formatConversion(
  value: number | null,
  locale: Locale = "en",
): string {
  return value === null
    ? "—"
    : `${formatMeasureFixedInLocale(value * PERCENT, locale)}%`;
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

const ENGLISH_CONTEXT: TranslationContext = {
  locale: "en",
  translator: englishTranslator,
};

export function noSearchTermsFact(
  month: string | null | undefined,
  context: TranslationContext = ENGLISH_CONTEXT,
): string | null {
  if (!month) return null;
  return context.translator("funnel.noSearchTerms", {
    console: context.translator("funnel.copy.googlePlay.console"),
    month: formatMonthInLocale(month, context.locale),
  });
}
