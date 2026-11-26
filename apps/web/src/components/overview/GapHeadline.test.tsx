import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  CompetitorAnalysis,
  CompetitorGapKeyword,
  CompetitorGaps,
  CompetitorItem,
} from "@asobeast/shared";
import { competitorAnalysisOptions, competitorsOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";
import { GapHeadline } from "./GapHeadline";

vi.mock("@/components/app-detail/use-market", () => ({
  useKeywordScope: () => ({ country: undefined, switchable: false }),
}));

const ROW: CompetitorGapKeyword = {
  keywordId: "kw-4",
  text: "productivity app",
  volume: 65,
  difficulty: 60,
  opportunity: 38,
  yourPosition: null,
  bestCompetitorPosition: 8,
  bestCompetitorId: "comp-1",
  gap: null,
  country: "us",
};

const GAPS: CompetitorGaps = {
  theyRankYouDont: [],
  youRankTheyDont: [],
  outranked: [],
  keywordGaps: [ROW],
  winnable: [ROW],
  threats: [],
  lead: [],
  coverage: {
    competitors: 1,
    delisted: 0,
    markets: [{ country: "us", keywords: 1, compared: 1 }],
  },
};

const ANALYSIS: CompetitorAnalysis = {
  metadataComparison: [],
  gaps: GAPS,
  positionMap: [],
};

const COMPETITORS: CompetitorItem[] = [
  {
    id: "comp-1",
    store: "APP_STORE",
    name: "Rival Focus",
    iconUrl: null,
    latestSnapshot: null,
  },
];

function markup(locale: "en" | "zh-CN"): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(competitorAnalysisOptions("app-1").queryKey, ANALYSIS);
  client.setQueryData(competitorsOptions("app-1").queryKey, COMPETITORS);
  return renderToStaticMarkup(
    <TestIntlProvider locale={locale}>
      <QueryClientProvider client={client}>
        <GapHeadline id="app-1" home="us" />
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}

function textContent(rendered: string): string {
  return rendered.replace(/<[^>]+>/g, "");
}

describe("GapHeadline translator-safe names", () => {
  it("keeps the English headline unchanged", () => {
    expect(textContent(markup("en"))).toContain(
      "1 winnable gap. Biggest: productivity app, Rival Focus ranks #8, you are not ranked.",
    );
  });

  it("protects keyword and competitor app names from browser translation", () => {
    const rendered = markup("zh-CN");

    expect(rendered).toContain('<span translate="no">productivity app</span>');
    expect(rendered).toContain('<span translate="no">Rival Focus</span>');
    expect(textContent(rendered)).toContain("Rival Focus 排名第 8");
  });
});
