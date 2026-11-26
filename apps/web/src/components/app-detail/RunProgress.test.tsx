import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppRunStatus } from "@asobeast/shared";
import { appRunStatusOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { RunDailyAction } from "./RunDailyAction";
import { RunProgress } from "./RunProgress";

const STATUS: AppRunStatus = {
  appId: "app-1",
  date: "2026-10-15",
  state: "running",
  startedAt: "2026-10-15T03:00:00.000Z",
  lastCaptureAt: null,
  stages: [
    { stage: "listings", ready: 2, total: 4, complete: false },
    { stage: "keywords", ready: 8, total: 40, complete: false },
    { stage: "categories", ready: 2, total: 2, complete: true },
  ],
};

describe("Simplified Chinese run progress", () => {
  it("localizes the visible progress and accessible run label", () => {
    const client = new QueryClient();
    client.setQueryData(appRunStatusOptions("app-1").queryKey, STATUS);
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <QueryClientProvider client={client}>
          <RunProgress appId="app-1" />
        </QueryClientProvider>
      </TestIntlProvider>,
    );

    expect(markup).toContain("已完成 12 / 46");
    expect(markup).toContain('aria-label="今日运行：已完成 12 / 46 项检查"');
    expect(markup).not.toContain("Today's run");
  });

  it("localizes the run-daily action", () => {
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <QueryClientProvider client={new QueryClient()}>
          <RunDailyAction appId="app-1" />
        </QueryClientProvider>
      </TestIntlProvider>,
    );

    expect(markup).toContain('aria-label="运行每日检查"');
    expect(markup).toContain("运行每日检查");
    expect(markup).not.toContain("Run daily");
  });
});
