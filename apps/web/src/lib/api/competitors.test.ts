import { afterEach, describe, expect, it, vi } from "vitest";
import { getCompetitorAnalysis } from "./competitors";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getCompetitorAnalysis", () => {
  it("asks for the analysis of the app", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      urls.push(String(input));
      return Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    await getCompetitorAnalysis("app-1");

    expect(new URL(urls[0]).pathname).toMatch(
      /\/apps\/app-1\/competitors\/analysis$/,
    );
  });
});
