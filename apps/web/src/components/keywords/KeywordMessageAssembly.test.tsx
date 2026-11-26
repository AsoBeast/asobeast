import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScoreSignals, TrackedKeywordItem } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import { translationContext } from "@/test/translation-context";
import { quotaNotice } from "@/lib/keyword-import";
import { keywordCountriesOptions, keywordsOptions } from "@/lib/queries";
import { ImportFileStep } from "./ImportFileStep";
import { popularitySignalLines } from "./score-signals";
import { TrackedSummary } from "./TrackedSummary";
import { untrackedCombinationSentence } from "./KeywordCombinations";

function keywordTranslator(overrides: Record<string, unknown>) {
  return createTranslator({
    locale: "en",
    namespace: "keywords",
    messages: {
      keywords: { ...enKeywords, ...overrides },
    } as Parameters<typeof createTranslator>[0]["messages"],
  });
}

function textContent(markup: string): string {
  return markup.replace(/<[^>]+>/g, "");
}

const SUMMARY = {
  rows: 3,
  new: 0,
  resume: 0,
  tracked: 0,
  duplicate: 0,
  invalid: 0,
  overQuota: 3,
};

const SIGNALS: ScoreSignals = {
  suggestReach: "hit",
  suggestPrefixLength: 2,
  suggestPosition: 8,
  serpRelevance: 0.9,
  medianRatingCount: 45_000,
  flags: [],
  officialPopularity: 41,
  officialPopularityState: "floor",
  officialPopularityFloor: 41,
  officialPopularityWeek: "2026-10-18",
  estimatedTraffic: 5.4,
};

const KEYWORD: TrackedKeywordItem = {
  keywordId: "kw-1",
  text: "focus timer",
  country: "us",
  source: "MANUAL",
  active: true,
  latestPosition: 7,
  latestDepth: 200,
  latestCheckedOn: "2026-11-25",
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

describe("complete keyword ICU messages", () => {
  it("lets the import file hint reorder its clauses", () => {
    const messages = {
      keywords: {
        ...enKeywords,
        import: {
          ...enKeywords.import,
          fileHint: "Encoding follows {limit, number} rows.",
          readingFile: "{file} follows {limit, number} rows.",
        },
      },
    };
    const render = (fileName: string | null) =>
      textContent(
        renderToStaticMarkup(
          <NextIntlClientProvider
            locale="en"
            timeZone="UTC"
            messages={messages}
          >
            <ImportFileStep
              fileName={fileName}
              onChoose={() => undefined}
              disabled={false}
            />
          </NextIntlClientProvider>,
        ),
      );

    expect(render(null)).toContain("Encoding follows 500 rows.");
    expect(render("keywords.csv")).toContain("keywords.csv follows 500 rows.");
  });

  it("lets the quota notice reorder usage and row count", () => {
    const t = keywordTranslator({
      import: {
        ...enKeywords.import,
        quotaNotice:
          "{count, number} blocked; {usage, select, none {no markets} other {{usage} used}}.",
      },
    });

    expect(
      quotaNotice(
        {
          summary: SUMMARY,
          quota: { used: 0, limit: 0, upgradeTo: null },
        },
        translationContext("en", "billing"),
        t,
      )?.text,
    ).toBe("3 blocked; no markets.");
  });

  it("lets the score floor sentence reorder week and floor", () => {
    const t = keywordTranslator({
      scores: {
        ...enKeywords.scores,
        signals: {
          ...enKeywords.scores.signals,
          floorAnswerLine:
            "Week {week, select, none {none} other {{week}}}; floor {floor, select, none {none} other {{floor, number}}}.",
        },
      },
    });

    expect(
      popularitySignalLines(SIGNALS, "APPLE_ADS_POPULARITY", null, t)[0],
    ).toBe("Week 18 Oct 2026; floor 41.");
  });

  it("lets the combination count sentence reorder its label", () => {
    const t = keywordTranslator({
      combinations: {
        ...enKeywords.combinations,
        untrackedSentence: "Untracked: {count, number}.",
      },
    });

    expect(untrackedCombinationSentence(false, 2, t)).toBe("Untracked: 2.");
  });

  it("lets the tracked summary reorder movement before tracking", () => {
    const client = new QueryClient();
    client.setQueryData(keywordCountriesOptions("app-1").queryKey, [
      { country: "us", keywordCount: 2 },
    ]);
    client.setQueryData(
      keywordsOptions("app-1", "us").queryKey,
      [
        KEYWORD,
        {
          ...KEYWORD,
          keywordId: "kw-2",
          previousPosition: 7,
          positionDelta1d: 0,
        },
      ],
      { updatedAt: Date.parse("2026-11-25T12:00:00.000Z") },
    );
    const messages = {
      keywords: {
        ...enKeywords,
        summary: {
          ...enKeywords.summary,
          withMovedAll:
            "<movement>{moved}</movement> | Tracking <countValue>{count, number}</countValue> of <totalValue>{total, number}</totalValue> keywords · <activeValue>{active, number}</activeValue> active",
        },
      },
    };
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
        <QueryClientProvider client={client}>
          <TrackedSummary id="app-1" market="us" />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    expect(textContent(markup)).toBe(
      "1 climbed since yesterday. | Tracking 2 of 2 keywords · 2 active",
    );
  });
});
