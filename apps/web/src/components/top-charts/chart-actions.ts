import type {
  AppListItem,
  ChartAppLink,
  ChartAppRole,
  ChartKey,
  ChartPage,
  PlanLimits,
  Store,
} from "@asobeast/shared";
import { ApiError } from "@/lib/api";
import { createTranslator } from "next-intl";
import enTopCharts from "../../../messages/en/topCharts.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDateInLocale, storeLabel } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "topCharts",
  messages: { topCharts: enTopCharts },
});

export interface RowLink {
  href: string;
  label: string;
  role: ChartAppRole;
}

export function rowLink(
  link: ChartAppLink | undefined,
  t: MessageTranslator = english,
): RowLink | null {
  if (!link) return null;
  if (link.role === "own") {
    return { href: `/apps/${link.appId}`, label: t("row.yours"), role: "own" };
  }
  return {
    href: `/apps/${link.primaryAppId ?? link.appId}/competitors`,
    label: t("row.competitorOf", {
      name: link.name ?? t("row.yourApp"),
    }),
    role: "competitor",
  };
}

export interface ChartRowContext {
  chart: ChartKey;
  links: ReadonlyMap<string, ChartAppLink>;
  apps: readonly AppListItem[];
}

export function rowContextOf(
  page: Pick<ChartPage, "chart" | "apps">,
  apps: readonly AppListItem[],
): ChartRowContext {
  return {
    chart: page.chart,
    links: new Map(page.apps.map((link) => [link.storeAppId, link])),
    apps,
  };
}

export function candidateApps(
  apps: readonly AppListItem[],
  store: Store,
): AppListItem[] {
  return apps.filter((app) => app.store === store);
}

export function captureErrorText(
  error: unknown,
  t: MessageTranslator = english,
): string {
  if (!(error instanceof ApiError)) return t("capture.failed");
  const { statusCode, message } = error.envelope;
  if (statusCode === 429) return message;
  if (statusCode === 502) return t("capture.storeFailed");
  return t("capture.failed");
}

export function followErrorText(
  error: unknown,
  t: MessageTranslator = english,
): string {
  return error instanceof ApiError && error.envelope.statusCode === 403
    ? error.envelope.message
    : t("capture.followFailed");
}

export function captureCostText(
  limits: Pick<PlanLimits, "onDemand"> | undefined,
  t: MessageTranslator = english,
): string {
  if (!limits) return t("capture.once");
  const limit = limits.onDemand?.chartCapture.limit;
  if (limit === undefined) {
    return t("capture.everyWorkspace");
  }
  if (limit === 0) return t("capture.noCaptures");
  return t("capture.dailyLimit", { limit });
}

function emptyHint(
  captured: boolean,
  capturable: boolean,
  t: MessageTranslator,
): string {
  if (captured) {
    return capturable ? t("capture.pickCaptured") : t("capture.pickOnly");
  }
  return capturable ? t("capture.captureOrFollow") : t("capture.followOnly");
}

export function emptyChartBody(
  captured: boolean,
  limits: Pick<PlanLimits, "onDemand"> | undefined,
  t: MessageTranslator = english,
): string {
  const capturable = limits?.onDemand?.chartCapture.limit !== 0;
  return `${emptyHint(captured, capturable, t)} ${captureCostText(limits, t)}`;
}

export function noAppsBody(
  chart: Pick<ChartPage["chart"], "store" | "genreName">,
  day: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  return t("noAppsBody", {
    store: storeLabel(chart.store),
    genre: chart.genreName,
    date: formatDateInLocale(day, locale),
  });
}

export function noAppsToast(
  store: Store,
  t: MessageTranslator = english,
): string {
  return t("noAppsToast", { store: storeLabel(store) });
}

export const competitorFocusKey = (storeAppId: string) =>
  `competitor:${storeAppId}`;

export const captureFocusKey = (chart: ChartKey) =>
  `chart-capture:${chart.collection}`;
