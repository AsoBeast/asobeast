import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StoreSearchResult } from "@asobeast/shared";
import { DeleteAppMenu } from "./DeleteAppMenu";
import { FirstRun } from "./FirstRun";
import { ImportAppDialog } from "./ImportAppDialog";
import { StoreSearchField } from "./StoreSearchField";
import type { StoreSearch } from "./useStoreSearch";
import { TestIntlProvider } from "@/test/intl-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
}));

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
  };
});

function chineseMarkup(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={new QueryClient()}>
        {node}
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

const RESULT: StoreSearchResult = {
  storeAppId: "123",
  title: "Focus Timer",
  developer: "Example Developer",
  ratingAvg: 4.8,
  ratingCount: 12,
  iconUrl: null,
};

const SEARCH: StoreSearch = {
  input: { kind: "name", q: "focus" },
  problem: null,
  q: "focus",
  results: [RESULT],
  pending: false,
  settled: true,
  error: null,
  retry: () => undefined,
  firstResultRef: { current: null },
  enterName: () => null,
};

describe("Simplified Chinese app import and first run", () => {
  it("renders the import dialog, storefront help, and actions in Chinese", () => {
    const markup = chineseMarkup(<ImportAppDialog open />);

    expect(markup).toContain("导入应用");
    expect(markup).toContain("应用名称或应用商店链接");
    expect(markup).toContain("主应用商店地区");
    expect(markup).toContain("导入");
    expect(markup).toContain("App Store");
    expect(markup).toContain("apps.apple.com/us/app/");
    expect(markup).not.toContain("Import an app");
    expect(markup).not.toContain("App name or store URL");
    expect(markup).not.toContain("Home storefront");
  });

  it("renders the empty portfolio first-run promise in Chinese", () => {
    const markup = chineseMarkup(<FirstRun />);

    expect(markup).toContain("跟踪您的第一个应用");
    expect(markup).toContain("您将获得");
    expect(markup).toContain("几分钟内获取标题和副标题中关键词的排名");
    expect(markup).toContain("导入应用");
    expect(markup).not.toContain("Track your first app");
    expect(markup).not.toContain("What you get");
  });

  it("localizes app actions while preserving the app name", () => {
    const markup = chineseMarkup(
      <DeleteAppMenu id="app-1" name="Focus Timer" />,
    );

    expect(markup).toContain('aria-label="应用操作，Focus Timer"');
    expect(markup).toContain("Focus Timer");
    expect(markup).not.toContain("App actions, Focus Timer");
  });

  it("localizes store result chrome and counts without translating store data", () => {
    const markup = chineseMarkup(
      <StoreSearchField
        id="import-url"
        label="应用名称或应用商店链接"
        hint="输入名称进行搜索，或粘贴应用商店链接。"
        placeholder="Focus Timer"
        store="APP_STORE"
        country="de"
        value="focus"
        onChange={() => undefined}
        onPick={() => undefined}
        search={SEARCH}
        error={null}
        note={null}
      />,
    );

    expect(markup).toContain("App Store 在德国的搜索结果");
    expect(markup).toContain("4.8 · 12 条评分");
    expect(markup).toContain("Focus Timer");
    expect(markup).toContain("Example Developer");
    expect(markup).not.toContain("Results from App Store in Germany");
    expect(markup).not.toContain("12 ratings");
  });
});
