import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDetail, SnapshotDiffResult } from "@asobeast/shared";
import { appDetailOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { AppHeader } from "./AppHeader";
import { AppLink } from "./AppLink";
import { RefreshAction } from "./RefreshAction";
import { SnapshotDiffDialog } from "./SnapshotDiffDialog";

const marketState = vi.hoisted(() => ({
  market: "de" as string | undefined,
  refreshable: true,
}));

vi.mock("./use-market", () => ({
  useCachedMarket: () => marketState,
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

const DIFF: SnapshotDiffResult = {
  snapshotId: "snapshot-2",
  country: "de",
  changes: [
    { field: "title", before: "Before", after: "After" },
    { field: "ratingAvg", before: 4.1, after: 4.8 },
  ],
};

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
  latestSnapshot: null,
};

describe("Simplified Chinese refresh and snapshot diff", () => {
  beforeEach(() => {
    marketState.market = "de";
    marketState.refreshable = true;
  });

  it("localizes store-linking controls without translating the app name", () => {
    const markup = chineseMarkup(<AppLink detail={DETAIL} />);
    expect(markup).toContain("关联应用商店页面");
    expect(markup).not.toContain("Link store listing");

    const linked = chineseMarkup(
      <AppLink
        detail={{
          ...DETAIL,
          group: {
            id: "group-1",
            name: "Focus Timer",
            members: [
              {
                id: DETAIL.id,
                store: DETAIL.store,
                country: DETAIL.country,
                name: DETAIL.name,
                iconUrl: null,
              },
              {
                id: "app-2",
                store: "GOOGLE_PLAY",
                country: "us",
                name: "Focus Timer for Android",
                iconUrl: null,
              },
            ],
          },
        }}
      />,
    );
    expect(linked).toContain('aria-label="已关联应用选项"');
    expect(linked).toContain('href="/apps/app-2"');
    expect(linked).toContain("Google Play");
  });

  it("localizes app-header chrome and the home storefront", () => {
    const client = new QueryClient();
    client.setQueryData(appDetailOptions("app-1").queryKey, DETAIL);
    const markup = renderToStaticMarkup(
      <TestIntlProvider locale="zh-CN">
        <QueryClientProvider client={client}>
          <AppHeader id="app-1" />
        </QueryClientProvider>
      </TestIntlProvider>,
    );

    expect(markup).toContain("Focus Timer");
    expect(markup).toContain("主应用商店地区 美国");
    expect(markup).toContain("应用商店页面");
    expect(markup).not.toContain("Home storefront");
  });

  it("localizes refresh actions and the stale-market explanation", () => {
    const active = chineseMarkup(<RefreshAction appId="app-1" />);
    expect(active).toContain('aria-label="刷新德国的应用页面"');
    expect(active).toContain(">刷新<");
    expect(active).not.toContain("Refresh Germany listing");

    marketState.refreshable = false;
    const stale = chineseMarkup(<RefreshAction appId="app-1" />);
    expect(stale).toContain(
      "德国已不再跟踪任何关键词，因此不再刷新该市场的应用页面。",
    );
  });

  it("uses ICU field counts and preserves changed store values", () => {
    const markup = chineseMarkup(
      <SnapshotDiffDialog
        diff={DIFF}
        market="de"
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(markup).toContain("已在德国刷新快照");
    expect(markup).toContain("自上次快照以来有 2 个字段发生变化。");
    expect(markup).toContain("标题");
    expect(markup).toContain("评分");
    expect(markup).toContain("Before");
    expect(markup).toContain("After");
    expect(markup).toContain("4.1");
    expect(markup).toContain("4.8");
    expect(markup).not.toContain("Snapshot refreshed in Germany");
  });

  it("uses the singular field message and localizes the unchanged state", () => {
    const changed = chineseMarkup(
      <SnapshotDiffDialog
        diff={{ ...DIFF, changes: [DIFF.changes[0]] }}
        market={null}
        open
        onOpenChange={() => undefined}
      />,
    );
    expect(changed).toContain("已刷新快照");
    expect(changed).toContain("自上次快照以来有 1 个字段发生变化。");

    const unchanged = chineseMarkup(
      <SnapshotDiffDialog
        diff={{ ...DIFF, changes: [] }}
        market={null}
        open
        onOpenChange={() => undefined}
      />,
    );
    expect(unchanged).toContain("自上次快照以来，应用商店页面未发生变化。");
    expect(unchanged).toContain("未检测到变化。");
  });
});
