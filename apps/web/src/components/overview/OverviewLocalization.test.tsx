import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AppDetail, AppSummary } from "@asobeast/shared";
import { catalogs } from "@/i18n/messages";
import {
  appDetailOptions,
  appListingOptions,
  appSummaryOptions,
} from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import enOverview from "../../../messages/en/overview.json";
import { OverviewPulse } from "./OverviewPulse";
import { CoverageCard } from "./CoverageCard";
import { SnapshotFacts } from "./SnapshotFacts";

vi.mock("nuqs", () => ({
  useQueryState: () => ["visibility", () => undefined],
}));

vi.mock("@/components/app-detail/use-market", () => ({
  useMarket: () => ({ market: "us", home: "us" }),
  useKeywordScope: () => ({ country: undefined, switchable: false }),
}));

vi.mock("./OverviewChart", () => ({
  OverviewChart: () => <div data-slot="overview-chart" />,
}));

const DETAIL: AppDetail = {
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "123",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  searchable: true,
  competitors: [],
  group: null,
  latestSnapshot: {
    id: "snapshot-1",
    title: "Focus Timer",
    subtitle: null,
    summary: null,
    ratingAvg: 4.8,
    ratingCount: 12,
    installs: 1_200_000,
    price: 0,
    currency: "USD",
    version: "1.0.0",
    capturedAt: "2026-11-20T00:00:00.000Z",
  },
};

const SUMMARY: AppSummary = {
  visibility: { current: 42, delta7d: 3, delta30d: 5 },
  rankDistribution: {
    top1: 0,
    top3: 1,
    top10: 2,
    top50: 4,
    beyond: 2,
    unranked: 3,
  },
  movers: { up: [], down: [] },
  coverage: {
    inTitle: 1,
    inSubtitle: 1,
    inDescription: 2,
    uncoveredHighOpportunity: [],
  },
  lastRefreshAt: null,
  trackedKeywords: 12,
  competitors: 2,
  shareOfVoice: { current: 35.5, delta7d: 1.5, competitors: 2 },
  nonBrandedShareOfVoice: { current: 20.5, delta7d: null, competitors: 2 },
};

function chineseMarkup(
  node: React.ReactNode = <OverviewPulse id="app-1" />,
): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(appListingOptions("app-1").queryKey, DETAIL);
  client.setQueryData(appSummaryOptions("app-1").queryKey, SUMMARY);
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </TestIntlProvider>,
  );
}

function coverageMarkup(messages: Record<string, unknown>): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(appDetailOptions("app-1").queryKey, DETAIL);
  client.setQueryData(appSummaryOptions("app-1").queryKey, SUMMARY);
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <QueryClientProvider client={client}>
        <CoverageCard id="app-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function textContent(markup: string): string {
  return markup.replace(/<[^>]+>/g, "");
}

describe("Simplified Chinese overview metrics", () => {
  it("localizes metric labels and plural notes while preserving values", () => {
    const markup = chineseMarkup();

    expect(markup).toContain(">可见度<");
    expect(markup).toContain(">声量份额<");
    expect(markup).toContain(">进入前十的关键词<");
    expect(markup).toContain(">评分<");
    expect(markup).toContain("42");
    expect(markup).toContain("35.5%");
    expect(markup).toContain("4.8");
    expect(markup).toContain("12 条评分");
    expect(markup).toContain("对比 2 个竞品");
    expect(markup).toContain("20.5% 非品牌");
    expect(markup).toContain("共跟踪 12 个关键词");
    expect(markup).not.toContain(">Visibility<");
    expect(markup).not.toContain("12 ratings");
  });

  it("localizes metadata coverage and its empty state", () => {
    const markup = chineseMarkup(<CoverageCard id="app-1" />);

    expect(markup).toContain("元数据覆盖率");
    expect(markup).toContain("标题");
    expect(markup).toContain("副标题");
    expect(markup).toContain("描述");
    expect(markup).toContain("您的元数据已覆盖机会分最高的关键词。");
    expect(markup).not.toContain("Metadata coverage");
  });

  it("lets the catalog reorder the complete coverage ratio around rich found text", () => {
    const messages = {
      ...catalogs.en,
      overview: {
        ...enOverview,
        coverage: {
          ...enOverview.coverage,
          ratio: "{tracked} total: <emphasized>{found}</emphasized> covered",
        },
      },
    };
    const markup = coverageMarkup(messages);

    expect(textContent(markup)).toContain("12 total: 1 covered");
    expect(markup).toContain('<span class="font-semibold">1</span>');
    expect(textContent(markup)).not.toContain("1 of 12");
  });

  it("keeps the default English coverage ratio unchanged", () => {
    const markup = coverageMarkup(catalogs.en);

    expect(textContent(markup)).toContain("1 of 12");
    expect(markup).toContain('<span class="font-semibold">1</span>');
  });

  it("localizes snapshot facts while preserving the version and date value", () => {
    const markup = chineseMarkup(<SnapshotFacts id="app-1" />);

    expect(markup).toContain("120万 次安装");
    expect(markup).toContain("v1.0.0");
    expect(markup).toContain("免费");
    expect(markup).toContain("快照 2026年11月20日");
    expect(markup).not.toContain("installs");
  });
});
