import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TestIntlProvider } from "@/test/intl-provider";
import { KeywordSheet } from "./KeywordSheet";

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
  active: false,
  tags: ["core"],
  note: "Ship before Friday",
  keywordClass: "competitorBrand",
  keywordClassSource: "owner",
  latestPosition: 7,
  latestDepth: 200,
  latestCheckedOn: "2026-11-24",
  previousPosition: 9,
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

function sheetMarkup(value: TrackedKeywordItem): string {
  const client = new QueryClient();
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <KeywordSheet
            appId="app-1"
            store="APP_STORE"
            homeCountry="us"
            keyword={value}
            today="2026-11-25"
            marketTags={() => ["core"]}
            steps={{ previous: "kw-0", next: "kw-2" }}
            onStep={() => undefined}
            onClose={() => undefined}
            onOpenSerp={() => undefined}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

describe("Simplified Chinese keyword sheet", () => {
  it("localizes sheet facts and sections while preserving keyword, tags and note", () => {
    const markup = sheetMarkup(keyword);
    const text = markup.replace(/<[^>]+>/g, "");

    for (const value of [
      "上一个关键词",
      "下一个关键词",
      "排名",
      "热度",
      "难度",
      "机会",
      "排名历史",
      "搜索结果",
      "评分及其来源",
      "标签和备注",
      "编辑标签和备注",
      "竞品品牌关键词，由您设置",
    ]) {
      expect(markup).toContain(value);
    }
    expect(text).toContain("App Store · 美国 · 已暂停");
    expect(markup).toContain("focus timer");
    expect(markup).toContain("core");
    expect(markup).toContain("Ship before Friday");
    expect(markup).not.toContain("Position history");
    expect(markup).not.toContain("Scores and where they come from");
    expect(markup).not.toContain("Edit tags and note");
  });

  it("localizes the queued first check and missing position", () => {
    const markup = sheetMarkup({
      ...keyword,
      active: true,
      latestPosition: null,
      latestDepth: null,
      latestCheckedOn: null,
      previousPosition: null,
      positionDelta1d: null,
      positionDelta7d: null,
    });

    expect(markup).toContain("首次检查已排队。图表会在结果到达后显示。");
    expect(markup).toContain("检查中…");
    expect(markup).not.toContain("The first check is queued");
  });

  it("localizes a paused keyword that was never checked and has no notes", () => {
    const markup = sheetMarkup({
      ...keyword,
      active: false,
      tags: [],
      note: null,
      latestPosition: null,
      latestDepth: null,
      latestCheckedOn: null,
      previousPosition: null,
      positionDelta1d: null,
      positionDelta7d: null,
    });

    expect(markup).toContain("排名：尚未检查");
    expect(markup).toContain("暂无标签或备注。");
    expect(markup).not.toContain("Position: not checked yet");
  });
});
