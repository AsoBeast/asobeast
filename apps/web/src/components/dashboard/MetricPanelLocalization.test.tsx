import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  PortfolioApp,
  PortfolioHistory,
  PortfolioHistoryScope,
  PortfolioSummary,
} from "@asobeast/shared";
import type { DashboardMetric } from "@/lib/search-params";
import { catalogs } from "@/i18n/messages";
import zhDashboard from "../../../messages/zh-CN/dashboard.json";
import { portfolioHistoryKey, portfolioKey, runStatusKey } from "@/lib/queries";
import { MetricPanel } from "./MetricPanel";

const scopeState = vi.hoisted(() => ({
  scope: { appId: "app-1" } as PortfolioHistoryScope,
}));

vi.mock("nuqs", () => ({
  useQueryStates: () => [{}, () => undefined],
}));

vi.mock("./use-range-history", () => ({
  useDashboardRange: () => ({ days: 7, waiting: false }),
  useDashboardScope: () => ({ scope: scopeState.scope, waiting: false }),
}));

vi.mock("./PortfolioTrendChart", () => ({
  PortfolioTrendChart: ({ subject }: { subject: { region: string } }) => (
    <span data-slot="trend-region">{subject.region}</span>
  ),
  TrendLegend: () => null,
}));

vi.mock("./PortfolioBandsChart", () => ({
  PortfolioBandsChart: ({ label }: { label: string }) => (
    <span data-slot="bands-region">{label}</span>
  ),
  BandsLegend: () => null,
}));

const APP: PortfolioApp = {
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "123",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  groupId: null,
  groupName: null,
  visibility: { current: 42, delta7d: 3 },
  sparkline: [],
  trackedKeywords: 2,
  competitors: 1,
  lastCapturedAt: "2026-11-20T00:00:00.000Z",
};

const SUMMARY: PortfolioSummary = {
  apps: [APP],
  groups: [],
  totals: { apps: 1, trackedKeywords: 2, competitors: 1, changes7d: 0 },
  visibility: { current: 42, delta7d: 3 },
};

const HISTORY: PortfolioHistory = {
  days: 7,
  points: [],
  previous: [],
  change: {
    compared: true,
    visibilityDelta: 3,
    top10Delta: 0,
    movement: { up: 1, down: 0, entered: 0, lost: 0 },
    appsMoved: 1,
    movers: { up: [], down: [] },
  },
};

const messages = {
  ...catalogs["zh-CN"],
  dashboard: {
    ...zhDashboard,
    charts: {
      ...zhDashboard.charts,
      seriesTitleScope: "{name} :: {region}",
      seriesRegionScope: "{days} 天 :: {name} :: {region}",
      seriesTitleAll: "全部 :: {region}",
      seriesRegionAll: "{days} 天 :: 全部 :: {region}",
    },
  },
};

function markup(
  scope: PortfolioHistoryScope,
  metric: DashboardMetric = "visibility",
  history = HISTORY,
): string {
  scopeState.scope = scope;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(portfolioKey, SUMMARY);
  client.setQueryData(portfolioHistoryKey(7, scope), history);
  client.setQueryData(runStatusKey, {
    state: "complete",
    startedAt: null,
    lastCaptureAt: "2026-11-20T00:00:00.000Z",
    tracked: 2,
    captured: 2,
    stores: [],
  });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="zh-CN" timeZone="UTC" messages={messages}>
      <QueryClientProvider client={client}>
        <MetricPanel metric={metric} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("MetricPanel complete ICU scope messages", () => {
  it("lets the catalog place the scoped app before the metric and days", () => {
    const rendered = markup({ appId: "app-1" });

    expect(rendered).toContain("Focus Timer :: 可见度");
    expect(rendered).toContain("7 天 :: Focus Timer :: 可见度");
  });

  it("uses the same complete scope messages for the rank-bands chart", () => {
    const rendered = markup({ appId: "app-1" }, "top10", {
      ...HISTORY,
      bands: [],
    });

    expect(rendered).toContain("Focus Timer :: 关键词排名");
    expect(rendered).toContain("7 天 :: Focus Timer :: 关键词排名");
  });

  it("lets the catalog place the all-apps scope before the metric and days", () => {
    const rendered = markup({});

    expect(rendered).toContain("全部 :: 可见度");
    expect(rendered).toContain("7 天 :: 全部 :: 可见度");
  });
});
