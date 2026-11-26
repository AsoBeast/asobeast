import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTable, type Table } from "@tanstack/react-table";
import type { SetValues } from "nuqs";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { KeywordSuggestion, TrackedKeywordItem } from "@asobeast/shared";
import { TestIntlProvider } from "@/test/intl-provider";
import { translationContext } from "@/test/translation-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { keywordFilterParsers } from "@/lib/search-params";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { ImportKeywordsDialog } from "./ImportKeywordsDialog";
import { KeywordFacets } from "./KeywordFacets";
import { KeywordMoveSwitch } from "./KeywordMoveSwitch";
import { KeywordsBulkActions } from "./KeywordsBulkActions";
import { KeywordsDataTable } from "./KeywordsDataTable";
import { SuggestionList } from "./SuggestionList";
import { HIDDEN_KEYWORD_COLUMNS, keywordColumns } from "./keyword-columns";
import { keywordFilterChips, type KeywordFilters } from "./keyword-filters";
import { keywordTableFeatures } from "./keyword-table-features";

vi.mock("@/components/ui/dialog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/dialog")>();
  return {
    ...actual,
    Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: ({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    ),
    DialogClose: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

function chineseMarkup(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>{node}</TooltipProvider>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

function KeywordTableFixture() {
  const t = useTranslations("keywords");
  const table = useTable({
    features: keywordTableFeatures,
    data: [],
    columns: keywordColumns({
      appId: "app-1",
      store: "APP_STORE",
      homeCountry: "us",
      multiMarket: false,
      today: "2026-11-25",
      trend: { window: "7d", series: undefined },
      onOpenSerp: () => undefined,
      translator: t,
    }),
    state: { columnVisibility: HIDDEN_KEYWORD_COLUMNS },
  });
  return (
    <KeywordsDataTable
      table={table}
      chartedSet={new Set()}
      onClearFilters={() => undefined}
    />
  );
}

const EMPTY_TABLE = {
  getColumn: () => undefined,
  getFacetedRowModel: () => ({ rows: [] }),
  getFacetedUniqueValues: () => new Map(),
} as unknown as Table<typeof keywordTableFeatures, TrackedKeywordItem>;

const FILTERS: KeywordFilters = {
  q: "",
  source: [],
  bucket: [],
  status: "all",
  type: [],
  pop: [],
  diff: [],
  opp: [],
  pos: [],
  tag: [],
  zone: null,
  change: null,
};

const NO_FILTER_CHANGE = (() => undefined) as unknown as SetValues<
  typeof keywordFilterParsers
>;

const KEYWORD: TrackedKeywordItem = {
  keywordId: "kw-1",
  text: "focus timer",
  tags: ["core"],
  note: null,
  country: "us",
  source: "MANUAL",
  active: true,
  latestPosition: 7,
  latestDepth: 200,
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

const SUGGESTION: KeywordSuggestion = {
  text: "focus timer",
  strategy: "similar",
  seed: "focus timer",
  usedByCount: 2,
};

describe("Simplified Chinese keyword core", () => {
  it("renders tracked keyword table headers and the filtered empty state in Chinese", () => {
    const markup = chineseMarkup(<KeywordTableFixture />);

    for (const label of [
      "关键词",
      "排名",
      "变化",
      "最近 7 天",
      "机会",
      "热度",
      "难度",
      "洞察",
      "热门应用",
      "标签",
      "来源",
      "波动性",
      "添加时间",
      "前十竞品",
      "推荐触发",
      "操作",
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("没有关键词匹配这些筛选条件");
    expect(markup).not.toContain(">Keyword<");
    expect(markup).not.toContain("No keywords match these filters");
  });

  it("renders the add keyword dialog with localized labels and plurals", () => {
    const markup = chineseMarkup(
      <AddKeywordsDialog appId="app-1" store="APP_STORE" country="us">
        <button type="button">Open</button>
      </AddKeywordsDialog>,
    );

    expect(markup).toContain("添加关键词");
    expect(markup).toContain("市场");
    expect(markup).toContain("关键词市场");
    expect(markup).toContain("每行一个短语，或用逗号分隔");
    expect(markup).toContain("0/200 个关键词已就绪");
    expect(markup).toContain("取消");
    expect(markup).not.toContain("Add keywords");
    expect(markup).not.toContain("One phrase per line");
  });

  it("renders the CSV import dialog and file step in Chinese", () => {
    const markup = chineseMarkup(
      <ImportKeywordsDialog appId="app-1" store="APP_STORE" country="us">
        <button type="button">Open</button>
      </ImportKeywordsDialog>,
    );

    expect(markup).toContain("从 CSV 导入关键词");
    expect(markup).toContain("关键词文件");
    expect(markup).toContain("选择文件");
    expect(markup).toContain("下载模板");
    expect(markup).toContain("取消");
    expect(markup).toContain("暂无可导入内容");
    expect(markup).not.toContain("Import keywords from CSV");
    expect(markup).not.toContain("Choose a file");
  });
});

describe("Simplified Chinese keyword filters, suggestions, and bulk actions", () => {
  it("renders keyword facets, movement filters, and filter chips in Chinese", () => {
    const markup = chineseMarkup(
      <>
        <KeywordFacets
          table={EMPTY_TABLE}
          filters={FILTERS}
          setFilters={NO_FILTER_CHANGE}
        />
        <KeywordMoveSwitch
          keywords={[]}
          today="2026-11-25"
          value={null}
          onChange={() => undefined}
        />
        <span>
          {keywordFilterChips(
            { ...FILTERS, q: '"focus timer"', change: "fell" },
            translationContext("zh-CN", "keywords").translator,
          )
            .map((chip) => chip.label)
            .join(" | ")}
        </span>
      </>,
    );

    for (const label of [
      "排名",
      "机会",
      "热度",
      "难度",
      "类型",
      "状态",
      "来源",
      "分组",
      "自昨天以来的变化",
      "全部",
      "有变化",
      "下降",
      "跌出",
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("精确短语：focus timer");
    expect(markup).toContain("自昨天以来：下降");
    expect(markup).not.toContain("Opportunity");
    expect(markup).not.toContain("Change since yesterday");
  });

  it("renders suggestion actions and metadata in Chinese without translating suggestion text", () => {
    const markup = chineseMarkup(
      <SuggestionList
        strategy="similar"
        state={{ status: "ready", suggestions: [SUGGESTION] }}
        trackedTexts={new Set()}
        action={{
          kind: "track",
          pending: new Set(),
          onTrack: () => undefined,
        }}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain("focus timer");
    expect(markup).toContain("来自“focus timer”");
    expect(markup).toContain("2 个应用");
    expect(markup).toContain("跟踪");
    expect(markup).not.toContain("Tracked");
    expect(markup).not.toContain("from “focus timer”");
  });

  it("renders bulk keyword actions and selection counts in Chinese", () => {
    const markup = chineseMarkup(
      <KeywordsBulkActions
        appId="app-1"
        selectedKeywords={[KEYWORD, { ...KEYWORD, keywordId: "kw-2" }]}
        marketTags={["core"]}
        onClear={() => undefined}
        onExport={() => undefined}
        onShowDynamics={() => undefined}
      />,
    );

    for (const label of [
      "批量关键词操作",
      "已选 2 个关键词",
      "显示动态",
      "暂停",
      "停止跟踪",
      "清除选择",
      "清除",
      "所选关键词",
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain("Bulk keyword actions");
    expect(markup).not.toContain("Show dynamics");
    expect(markup).not.toContain("selected keywords");
  });
});
