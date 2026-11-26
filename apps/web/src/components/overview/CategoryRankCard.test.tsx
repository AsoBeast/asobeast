import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AppDetail, CategoryRankSeries } from "@asobeast/shared";
import { appDetailOptions, categoryRanksOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { TestIntlProvider } from "@/test/intl-provider";
import { CategoryRankCard } from "./CategoryRankCard";

vi.mock("nuqs", () => ({
  useQueryState: () => ["30d", () => undefined],
}));

vi.mock("@/components/ui/chart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/chart")>();
  return {
    ...actual,
    ChartContainer: ({
      config,
    }: {
      config: Record<string, { label?: React.ReactNode }>;
    }) => (
      <div data-slot="chart-config">
        {Object.entries(config).map(([key, item]) => (
          <span key={key}>{item.label}</span>
        ))}
      </div>
    ),
  };
});

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
    installs: null,
    price: 0,
    currency: "USD",
    version: "1.0.0",
    capturedAt: "2026-11-20T00:00:00.000Z",
  },
};

const SERIES: CategoryRankSeries = {
  series: [
    {
      collection: "free",
      genre: "6014",
      genreName: "Games",
      current: 12,
      depth: 100,
      points: [
        { date: "2026-11-19", position: 14 },
        { date: "2026-11-20", position: 12 },
      ],
    },
  ],
};

function markup(
  locale: "en" | "zh-CN",
  series: CategoryRankSeries = SERIES,
): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(appDetailOptions("app-1").queryKey, DETAIL);
  client.setQueryData(
    categoryRanksOptions("app-1", presetToRange("30d")).queryKey,
    series,
  );
  return renderToStaticMarkup(
    <TestIntlProvider locale={locale}>
      <QueryClientProvider client={client}>
        <CategoryRankCard id="app-1" />
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

function textContent(rendered: string): string {
  return rendered.replace(/<[^>]+>/g, "");
}

describe("CategoryRankCard translator-safe genre names", () => {
  it("keeps the English category headline and series label unchanged", () => {
    const rendered = markup("en");

    expect(textContent(rendered)).toContain("#12 in Games · free chart");
    expect(textContent(rendered)).toContain("Games · free");
  });

  it("protects genre names in the headline and chart series label", () => {
    const rendered = markup("zh-CN");

    expect(rendered).toContain('<span translate="no">Games</span>');
    expect(rendered).toContain('<span translate="no">Games</span> · 免费');
  });

  it("protects the genre name in the not-in-chart headline", () => {
    const rendered = markup("zh-CN", {
      series: [{ ...SERIES.series[0], current: null }],
    });

    expect(rendered).toContain('<span translate="no">Games</span>');
    expect(textContent(rendered)).toContain("未进入 Games 的前 100 名");
  });
});
