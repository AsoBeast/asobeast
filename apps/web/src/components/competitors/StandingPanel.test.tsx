import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CompetitorAnalysis } from "@asobeast/shared";
import { CollapsedSectionsProvider } from "@/components/layout/CollapsedSections";
import { appDetailOptions, competitorAnalysisOptions } from "@/lib/queries";
import { COMPETITOR_SECTIONS } from "./competitor-sections";
import { StandingPanel } from "./StandingPanel";

const APP = "app-1";
const ERROR_TEXT = "The comparison could not be loaded.";

const analysis: CompetitorAnalysis = {
  metadataComparison: [],
  gaps: { theyRankYouDont: [], youRankTheyDont: [], outranked: [] },
  positionMap: [
    {
      appId: APP,
      name: "Focus",
      isYou: true,
      visibility: 62.4,
      ratingAvg: 4.6,
    },
    {
      appId: "c",
      name: "Rival",
      isYou: false,
      visibility: 58.1,
      ratingAvg: 4.2,
    },
  ],
};

const refuse = () => Promise.reject(new Error("unreachable"));

async function panelWith(seed: (client: QueryClient) => Promise<void>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await seed(client);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <CollapsedSectionsProvider initial={[]} known={COMPETITOR_SECTIONS}>
        <StandingPanel id={APP} />
      </CollapsedSectionsProvider>
    </QueryClientProvider>,
  );
}

describe("StandingPanel", () => {
  it("offers a retry when the app read failed, instead of a lasting skeleton", async () => {
    const markup = await panelWith(async (client) => {
      client.setQueryData(competitorAnalysisOptions(APP).queryKey, analysis);
      await client.prefetchQuery({
        ...appDetailOptions(APP),
        queryFn: refuse,
      });
    });

    expect(markup).toContain(ERROR_TEXT);
    expect(markup).toContain("Retry");
  });

  it("offers a retry when the analysis read failed", async () => {
    const markup = await panelWith(async (client) => {
      await client.prefetchQuery({
        ...competitorAnalysisOptions(APP),
        queryFn: refuse,
      });
    });

    expect(markup).toContain(ERROR_TEXT);
  });

  it("shows no error while both reads are pending", async () => {
    const markup = await panelWith(() => Promise.resolve());

    expect(markup).not.toContain(ERROR_TEXT);
    expect(markup).toContain("How you compare");
  });
});
