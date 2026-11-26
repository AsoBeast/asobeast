import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  KeywordInspection,
  KeywordInspectionResult,
  KeywordInspectionSummary,
} from "@asobeast/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { keywordInspectionOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { InspectForm } from "./InspectForm";
import { InspectionDetail } from "./InspectionDetail";
import { InspectionLog } from "./InspectionLog";
import { InspectionMap } from "./InspectionMap";
import { InspectionFigures } from "./InspectionScores";
import { InspectionResultsTable } from "./InspectionResultsTable";

const result: KeywordInspectionResult = {
  position: 1,
  storeAppId: "store-1",
  title: "Store Result One",
  developer: "Store Developer",
  iconUrl: null,
  ratingAvg: 4.7,
  ratingCount: 8400,
  releasedAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-11-20T00:00:00.000Z",
  titleMatch: "phrase",
  titleSegments: [],
};

const summary: KeywordInspectionSummary = {
  id: "inspection-1",
  keywordId: "keyword-1",
  keyword: "habit tracker",
  store: "APP_STORE",
  country: "us",
  status: "DONE",
  requestedAt: "2026-11-24T10:00:00.000Z",
  startedAt: "2026-11-24T10:00:01.000Z",
  completedAt: "2026-11-24T10:00:05.000Z",
  volume: 65,
  difficulty100: 18,
  opportunity: 70,
  resultCount: 1,
};

const inspection: KeywordInspection = {
  ...summary,
  provenance: {
    source: "APPLE_SEARCH_SIGNALS",
    formulaVersion: "3",
    confidence: "HIGH",
  },
  suggestReach: "hit",
  signals: {
    suggestReach: "hit",
    suggestPrefixLength: 5,
    suggestPosition: 1,
    serpRelevance: 0.9,
    medianRatingCount: 45_000,
    flags: [],
    officialPopularity: 41,
    officialPopularityState: "floor",
    officialPopularityFloor: 41,
    officialPopularityWeek: "2026-10-18",
    estimatedTraffic: 5.4,
  },
  competition: {
    topCount: 10,
    medianRatingCount: 16_000,
    strongestRatingCount: 250_000,
    averageRating: 4.5,
    exactTitleMatches: 2,
    titleMatches: 7,
    appsOverHundredThousandRatings: 2,
    medianDaysSinceUpdate: 12,
    freshlyUpdated: 8,
  },
  results: [result],
  suggestions: [{ position: 1, term: "habit tracker app" }],
  previous: {
    inspectionId: "inspection-0",
    completedAt: "2026-11-23T10:00:05.000Z",
    volume: 61,
    difficulty100: 22,
    resultCount: 10,
    entered: [{ storeAppId: "store-1", title: "Store Result One" }],
    left: [{ storeAppId: "store-9", title: "Former Result" }],
  },
  failure: null,
};

function provider(node: React.ReactNode, client = new QueryClient()) {
  return (
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </TestIntlProvider>
  );
}

describe("Simplified Chinese keyword inspector", () => {
  it("localizes the inspect form without translating the entered keyword", () => {
    const markup = renderToStaticMarkup(
      provider(
        <InspectForm
          initial={{
            keyword: "Habit Tracker",
            store: "APP_STORE",
            country: "us",
          }}
          onInspected={() => undefined}
        />,
      ),
    );

    for (const text of [
      "检查关键词",
      "关键词",
      "例如 habit tracker",
      "应用商店",
      "国家/地区",
      "检查",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain("Habit Tracker");
    expect(markup).not.toContain("Inspect a keyword");
    expect(markup).not.toContain("e.g. habit tracker");
  });

  it("localizes inspector figures and keeps the previous scores", () => {
    const markup = renderToStaticMarkup(
      provider(
        <InspectionFigures
          inspection={inspection}
          previous={inspection.previous}
        />,
      ),
    );

    for (const text of ["评分", "热度", "难度", "机会", "原为 61", "原为 22"]) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toContain("Popularity");
    expect(markup).not.toContain("was 61");
  });

  it("localizes result table chrome while preserving store-written app text", () => {
    const markup = renderToStaticMarkup(
      provider(
        <InspectionResultsTable
          keyword="habit tracker"
          results={[result]}
          entered={[{ storeAppId: "store-1", title: "Store Result One" }]}
          at={inspection.completedAt ?? inspection.requestedAt}
        />,
      ),
    );

    for (const text of [
      "“habit tracker”的前 1 个结果，按应用商店顺序",
      "应用",
      "标题命中",
      "评分",
      "完整短语",
      "新进入",
      "4 天前更新",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain("Store Result One");
    expect(markup).toContain("Store Developer");
    expect(markup).not.toContain("Title match");
    expect(markup).not.toContain("Exact phrase");
  });

  it("localizes the inspection log, statuses and retention footer", () => {
    const items: KeywordInspectionSummary[] = [
      summary,
      {
        ...summary,
        id: "inspection-2",
        keywordId: "keyword-2",
        keyword: "water reminder",
        country: "gb",
        status: "PENDING",
        completedAt: null,
        volume: null,
        difficulty100: null,
        opportunity: null,
      },
    ];
    const markup = renderToStaticMarkup(
      provider(
        <InspectionLog
          items={items}
          selected="inspection-1"
          onSelect={() => undefined}
          onDeleted={() => undefined}
        />,
      ),
    );

    for (const text of [
      "所有检查",
      "应用商店地区",
      "检查时间",
      "运行中",
      "2 次检查，覆盖 2 个应用商店地区 · 保留最新 50 条",
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain("habit tracker");
    expect(markup).toContain("water reminder");
    expect(markup).not.toContain("All inspections");
    expect(markup).not.toContain("the newest 50 are kept");
  });
});

describe("Simplified Chinese inspection details and map", () => {
  it("localizes completed inspection states and competition figures", () => {
    const client = new QueryClient();
    client.setQueryData(
      keywordInspectionOptions("inspection-1").queryKey,
      inspection,
    );
    const markup = renderToStaticMarkup(
      provider(
        <InspectionDetail
          id="inspection-1"
          items={[summary]}
          onInspected={() => undefined}
          onSelect={() => undefined}
        />,
        client,
      ),
    );

    const text = markup.replace(/<[^>]+>/g, "");
    for (const value of [
      "搜索结果",
      "前 1 个，共 1 个",
      "前 10 中的竞争",
      "典型评分",
      "新进入者",
      "自上次检查以来",
      "Store Result One进入了前十",
      "Former Result离开了前十",
    ]) {
      expect(text).toContain(value);
    }
    expect(markup).toContain("Store Result One");
    expect(markup).not.toContain("Competition in the top 10");
  });

  it("localizes the inspector map empty state and keyboard help", () => {
    const markup = renderToStaticMarkup(
      provider(
        <InspectionMap
          points={[]}
          storefront={{ store: "APP_STORE", country: "us" }}
          selectedKeywordId={null}
          onSelect={() => undefined}
        />,
      ),
    );

    expect(markup).toContain("关键词地图");
    expect(markup).toContain("地图上暂无内容");
    expect(markup).toContain(
      "在App Store的美国检查关键词后，它会按热度和难度显示在这里。",
    );
    expect(markup).not.toContain("Nothing on the map yet");
  });
});
