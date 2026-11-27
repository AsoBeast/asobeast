import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PortfolioApp,
  PortfolioAppHistory,
  PortfolioAppInsight,
  PortfolioHistory,
  PortfolioInsights,
  PortfolioSummary,
} from "@asobeast/shared";
import { AppsDashboard } from "./AppsDashboard";
import { AppsToolbar } from "./AppsToolbar";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const listState = vi.hoisted(() => ({
  q: "",
  sort: "visibility",
  dir: null,
  view: "table",
  store: null,
}));

vi.mock("nuqs", () => ({
  useQueryStates: () => [listState, () => undefined],
}));

vi.mock("./use-range-history", () => ({
  useDashboardRange: () => ({ days: 7, waiting: false }),
  useRangeHistory: () => ({ days: 7, history: HISTORY }),
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
  setup: {
    status: "in_progress",
    updatedAt: "2026-11-20T00:00:00.000Z",
    done: 1,
    total: 3,
    next: "countries",
  },
};

const INSIGHT: PortfolioAppInsight = {
  appId: APP.id,
  rankDistribution: {
    top1: 0,
    top3: 1,
    top10: 1,
    top50: 0,
    beyond: 0,
    unranked: 1,
  },
  top10Delta7d: 1,
  movement: { up: 1, down: 0, entered: 0, lost: 0 },
  rating: { average: 4.8, count: 20, averageDelta7d: null },
  audit: null,
  actions: { open: 2, critical: 1, high: 0 },
  changes7d: { own: 1, competitors: 0 },
  negativeReviews7d: 0,
};

const RANGE: PortfolioAppHistory = {
  appId: APP.id,
  points: [],
  change: {
    visibility: 42,
    visibilityDelta: 3,
    top10: 1,
    top10Delta: 1,
    movement: { up: 1, down: 0, entered: 0, lost: 0 },
  },
  lastRun: { up: 1, down: 0, entered: 0, lost: 0 },
};

const HISTORY: PortfolioHistory = {
  days: 7,
  points: [],
  previous: [],
  change: {
    compared: true,
    visibilityDelta: 3,
    top10Delta: 1,
    movement: { up: 1, down: 0, entered: 0, lost: 0 },
    appsMoved: 1,
    movers: { up: [], down: [] },
  },
  apps: [RANGE],
};

const SUMMARY: PortfolioSummary = {
  apps: [APP],
  groups: [],
  totals: { apps: 1, trackedKeywords: 2, competitors: 1, changes7d: 1 },
  visibility: { current: 42, delta7d: 3 },
};

const INSIGHTS: PortfolioInsights = {
  apps: [INSIGHT],
  movers: { up: [], down: [] },
  totals: {
    top10: 1,
    top10Delta7d: 1,
    movement: { up: 1, down: 0, entered: 0, lost: 0 },
    changes7d: { own: 1, competitors: 0 },
    negativeReviews7d: 0,
  },
};

function localizedMarkup(
  node: React.ReactNode,
  locale: "en" | "zh-CN" = "zh-CN",
  summary = SUMMARY,
): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(portfolioOptions.queryKey, summary);
  client.setQueryData(portfolioInsightsOptions.queryKey, INSIGHTS);
  return renderToStaticMarkup(
    <TestIntlProvider locale={locale}>
      <QueryClientProvider client={client}>
        <TooltipProvider>{node}</TooltipProvider>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

function chineseMarkup(node: React.ReactNode, summary = SUMMARY): string {
  return localizedMarkup(node, "zh-CN", summary);
}

describe("Simplified Chinese dashboard and apps table", () => {
  beforeEach(() => {
    listState.q = "";
    listState.sort = "visibility";
    listState.dir = null;
    listState.view = "table";
    listState.store = null;
  });

  it("renders the apps shell, table, counts, and range footer in Chinese", () => {
    const markup = chineseMarkup(<AppsDashboard />);

    expect(markup).toContain("应用");
    expect(markup).toContain("此工作区中的应用");
    expect(markup).toContain("可见度");
    expect(markup).toContain("进入前十");
    expect(markup).toContain("Focus Timer");
    expect(markup).toContain("US");
    expect(markup).toContain("2 个关键词");
    expect(markup).toContain("设置 1/3");
    expect(markup).toContain("覆盖上方所选时间范围");
    expect(markup).not.toContain("Apps in this workspace");
    expect(markup).not.toContain("Trend, 7d and Moved");
  });

  it("renders the Change range header in English and Chinese", () => {
    const english = localizedMarkup(<AppsDashboard />, "en");
    const chinese = chineseMarkup(<AppsDashboard />);

    expect(english).toContain(">7d</span>");
    expect(english).not.toContain("table.changeHeader");
    expect(chinese).toContain(">7 天</span>");
    expect(chinese).not.toContain("table.changeHeader");
  });

  it("renders the filtered empty state without translating the entered query", () => {
    listState.q = "missing app";
    const markup = chineseMarkup(<AppsDashboard />, {
      ...SUMMARY,
      apps: [],
      totals: { ...SUMMARY.totals, apps: 0 },
    });

    expect(markup).toContain("没有应用匹配“missing app”");
    expect(markup).toContain("清除筛选");
    expect(markup).not.toContain('No apps match "missing app"');
  });

  it("renders app search, sorting, and view controls in Chinese", () => {
    listState.view = "cards";
    listState.q = "focus";
    const markup = chineseMarkup(<AppsToolbar columns={null} />);

    expect(markup).toContain("搜索应用");
    expect(markup).toContain("排序方式");
    expect(markup).toContain("可见度");
    expect(markup).toContain("表格");
    expect(markup).toContain("卡片");
    expect(markup).not.toContain("Search apps");
    expect(markup).not.toContain("Sort by");
  });
});
