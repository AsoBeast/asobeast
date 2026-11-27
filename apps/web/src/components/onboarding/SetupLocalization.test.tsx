import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarketSuggestionsResult } from "@asobeast/shared";
import { SetupActions } from "./SetupActions";
import { SetupProgress, SetupStepList } from "./SetupProgress";
import { SelectedCountries } from "./SelectedCountries";
import { StepPanel } from "./StepPanel";
import { MarketCostTip, SuggestedMarkets } from "./SuggestedMarkets";
import { TestIntlProvider } from "@/test/intl-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

function chineseMarkup(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>{node}</TooltipProvider>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

const SUGGESTIONS: MarketSuggestionsResult = {
  home: "us",
  languages: ["en", "de"],
  suggestions: [],
};

describe("Simplified Chinese setup surfaces", () => {
  it("renders setup progress, step navigation, and step states in Chinese", () => {
    const progress = chineseMarkup(
      <SetupProgress
        name="Focus Timer"
        progress={{ done: 1, total: 3, next: "keywords" }}
      />,
    );
    const steps = chineseMarkup(
      <SetupStepList
        states={{ competitors: "done", keywords: "open", countries: "loading" }}
        next="keywords"
        layout="stacked"
      />,
    );

    expect(progress).toContain("设置 Focus Timer · 1/3 · 下一步：跟踪关键词");
    expect(progress).toContain('aria-label="设置进度"');
    expect(steps).toContain("选择竞品");
    expect(steps).toContain("跟踪关键词");
    expect(steps).toContain("添加国家");
    expect(steps).toContain("完成");
    expect(steps).toContain("下一步");
    expect(progress).not.toContain("Set up Focus Timer");
    expect(steps).not.toContain("Pick competitors");
  });

  it("renders a setup step panel and its skip action in Chinese", () => {
    const markup = chineseMarkup(
      <StepPanel
        step="keywords"
        state="open"
        description="在主应用商店地区至少跟踪 10 个关键词。"
        footer={<span>每个关键词会在每日运行时检查</span>}
        onSkip={() => undefined}
      >
        <span>关键词选择器</span>
      </StepPanel>,
    );

    expect(markup).toContain("跟踪关键词");
    expect(markup).toContain("跳过此步骤");
    expect(markup).toContain("在主应用商店地区至少跟踪 10 个关键词");
    expect(markup).not.toContain("Skip this step");
  });

  it("renders completion and dismissal controls in Chinese", () => {
    const markup = chineseMarkup(
      <SetupActions
        ready={false}
        failed={false}
        completable={false}
        hint={null}
        onRetry={() => undefined}
        onDismiss={() => undefined}
        onComplete={() => undefined}
      />,
    );

    expect(markup).toContain("忽略设置");
    expect(markup).toContain("完成设置");
    expect(markup).toContain("完成设置前，请等待所有实时计数加载完毕");
    expect(markup).not.toContain("Dismiss setup");
    expect(markup).not.toContain("Complete setup");
  });

  it("renders selected countries with localized names and ICU keyword counts", () => {
    const markup = chineseMarkup(
      <SelectedCountries
        appId="app-1"
        homeMarket="us"
        counts={[
          { market: "us", active: 1, error: false },
          { market: "de", active: 2, error: false },
        ]}
        onRemove={() => undefined}
      />,
    );

    expect(markup).toContain("已选国家");
    expect(markup).toContain("美国 (US)");
    expect(markup).toContain("德国 (DE)");
    expect(markup).toContain("1 个活跃关键词");
    expect(markup).toContain("2 个活跃关键词");
    expect(markup).toContain("移除 德国");
    expect(markup).toContain("/apps/app-1/keywords?country=de");
    expect(markup).not.toContain("Selected countries");
    expect(markup).not.toContain("active keywords");
  });

  it("renders market suggestions and cost help in Chinese", () => {
    const markup = chineseMarkup(
      <>
        <SuggestedMarkets
          appId="app-1"
          result={SUGGESTIONS}
          selected={["us"]}
          onSelect={() => undefined}
        />
        <MarketCostTip store="APP_STORE" />
      </>,
    );

    expect(markup).toContain("您的详情页提供英语和德语");
    expect(markup).toContain("添加国家");
    expect(markup).toContain("关于市场成本");
    expect(markup).not.toContain("Your listing ships");
    expect(markup).not.toContain("About market costs");
  });
});
