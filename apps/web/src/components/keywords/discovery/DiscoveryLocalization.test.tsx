import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { KeywordDiscoveryList } from "@asobeast/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { keywordDiscoveriesOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { DiscoveredKeywords } from "./DiscoveredKeywords";

const item = {
  keywordId: "discovery-1",
  text: "focus timer app",
  country: "us",
  source: "title" as const,
  position: 7,
  depth: 200,
  checkedOn: "2026-11-24",
  traffic: 52,
  difficulty: 4.1,
  volume: 52,
  relevance: 85,
  opportunity: 41,
  state: "ranked" as const,
  recommended: true,
};

const list: KeywordDiscoveryList = {
  items: [item],
  counts: { all: 1, ranked: 1, opportunity: 0 },
  autoTrackRanked: false,
  unfit: 2,
  checks: {
    perWeek: 40,
    usedThisWeek: 12,
    pending: 1,
    checkedAt: "2026-11-22T08:00:00.000Z",
    nextRunAt: "2026-11-30T07:30:00.000Z",
  },
};

function markup(
  value: KeywordDiscoveryList,
  state: "all" | "ranked" | "opportunity" = "all",
): string {
  const client = new QueryClient();
  client.setQueryData(
    keywordDiscoveriesOptions("app-1", "us").queryKey,
    value,
    { updatedAt: Date.parse("2026-11-25T12:00:00.000Z") },
  );
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <NuqsTestingAdapter searchParams={{ state }}>
            <DiscoveredKeywords id="app-1" store="APP_STORE" market="us" />
          </NuqsTestingAdapter>
        </TooltipProvider>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

describe("Simplified Chinese keyword discoveries", () => {
  it("localizes the list, states, actions and footer while preserving the keyword", () => {
    const output = markup(list);

    for (const text of [
      "发现的关键词",
      "搜索发现的关键词",
      "全部 1",
      "已排名 1",
      "机会 0",
      "自动跟踪已排名",
      "发现应用有排名时立即跟踪该关键词",
      "刷新发现",
      "跟踪推荐（1）",
      "跟踪所有已排名（1）",
      "您的标题",
      "排名第 7 位",
      "3 天前检查。每周 40 次检查，已使用 12 次；下次运行在星期一。",
      "1 次检查待处理",
      "2 个不符合您的套餐",
    ]) {
      expect(output).toContain(text);
    }
    expect(output).toContain("focus timer app");
    expect(output).toContain("跟踪 focus timer app");
    expect(output).not.toContain("Auto-track ranked");
    expect(output).not.toContain("Refresh discoveries");
  });

  it("localizes the opportunity empty state and its explanation", () => {
    const output = markup(list, "opportunity");

    expect(output).toContain("暂无机会");
    expect(output).toContain(
      "机会需要热度和难度评分。跟踪关键词后可获得评分，或等待下次评分运行。",
    );
    expect(output).toContain("显示全部");
    expect(output).not.toContain("No opportunities yet");
  });

  it("localizes the never-run state and queued explanation", () => {
    const output = markup(
      {
        ...list,
        items: [],
        counts: { all: 0, ranked: 0, opportunity: 0 },
        checks: { ...list.checks, checkedAt: null, pending: 2 },
      },
      "all",
    );

    expect(output).toContain("暂无发现");
    expect(output).toContain(
      "AsoBeast 已排队检查您详情页附近的关键词。在此市场找到的结果会显示在这里。",
    );
  });
});
