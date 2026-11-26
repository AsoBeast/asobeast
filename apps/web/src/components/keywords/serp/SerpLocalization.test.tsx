import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SerpSnapshot, TrackedKeywordItem } from "@asobeast/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { serpOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { SerpSheet } from "./SerpSheet";
import { SerpNeverChecked, SerpNoApps } from "./SerpStates";

vi.mock("@/components/ui/sheet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/sheet")>();
  return {
    ...actual,
    Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
    SheetContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SheetHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    SheetDescription: ({ children }: { children: ReactNode }) => (
      <p>{children}</p>
    ),
  };
});

const keyword: TrackedKeywordItem = {
  keywordId: "kw-1",
  text: "focus timer",
  country: "us",
  source: "MANUAL",
  active: true,
  latestPosition: 3,
  latestDepth: 200,
  previousPosition: 5,
  positionDelta1d: -2,
  positionDelta7d: -2,
  traffic: 55,
  difficulty: 4,
  volume: 5000,
  relevance: 90,
  opportunity: 82,
  bucket: "primary",
  scoredAt: "2026-11-25",
  scoreProvenance: null,
  serpVolatility7d: null,
};

const snapshot: SerpSnapshot = {
  keywordId: "kw-1",
  text: "focus timer",
  date: "2026-11-24",
  dates: ["2026-11-24", "2026-11-23"],
  comparedTo: "2026-11-23",
  entries: [
    {
      position: 1,
      storeAppId: "store-1",
      title: "Store Result One",
      developer: "Store Developer",
      ratingAvg: 4.7,
      ratingCount: 8400,
      appId: null,
      isCompetitor: false,
      titleMatch: "phrase",
    },
    {
      position: 3,
      storeAppId: "store-3",
      title: "Focus Timer — Store Title",
      developer: null,
      ratingAvg: null,
      ratingCount: null,
      appId: "app-1",
      isCompetitor: false,
      previous: 5,
      delta: -2,
      movement: "up",
    },
    {
      position: 11,
      storeAppId: "store-11",
      title: "Deeper Result",
      developer: null,
      ratingAvg: null,
      ratingCount: null,
      appId: null,
      isCompetitor: false,
    },
  ],
  exits: [
    {
      storeAppId: "store-9",
      title: "Former Result",
      developer: null,
      iconUrl: null,
      previous: 9,
      appId: null,
      isCompetitor: false,
    },
  ],
};

function serpMarkup(): string {
  const client = new QueryClient();
  client.setQueryData(serpOptions("kw-1").queryKey, snapshot);
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={{ serp: "kw-1" }}>
          <SerpSheet appId="app-1" store="APP_STORE" keyword={keyword} />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

describe("Simplified Chinese SERP sheet", () => {
  it("localizes sheet chrome, sections and figures without translating SERP data", () => {
    const markup = serpMarkup();

    for (const text of [
      "搜索结果",
      "每日检查时应用商店针对此关键词显示的应用。",
      "您的排名",
      "包含它的标题",
      "前十评分",
      "前 10",
      "第 11 至 11 位",
      "自 11月23日 以来离开",
      "您",
      "中位数",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain("focus timer");
    expect(markup).toContain("Store Result One");
    expect(markup).toContain("Store Developer");
    expect(markup).toContain("Focus Timer — Store Title");
    expect(markup).toContain("Former Result");
    expect(markup).not.toContain("Search results");
    expect(markup).not.toContain("Your position");
    expect(markup).not.toContain("Top 10 ratings");
  });

  it("localizes the never-checked and no-app states", () => {
    const neverChecked = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <SerpNeverChecked />
      </TestIntlProvider>,
    );
    const noApps = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <SerpNoApps date="2026-11-24" />
      </TestIntlProvider>,
    );

    expect(neverChecked).toContain(
      "尚未检查。搜索结果会在下次每日检查后显示。",
    );
    expect(noApps).toContain(
      "应用商店在 2026年11月24日没有为此关键词显示任何应用。",
    );
  });
});
