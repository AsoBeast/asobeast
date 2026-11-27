import { KEYWORD_TOOLS } from "@asobeast/mcp-tools";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerCatalogTools } from "./define.js";
import { createHarness, stubFetch } from "./harness.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("keyword tools", () => {
  it("passes sort and country as query params", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("list_keywords")!.handler({
      appId: "app-1",
      sort: "opportunity",
      country: "de",
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/apps/app-1/keywords");
    expect(url.searchParams.get("sort")).toBe("opportunity");
    expect(url.searchParams.get("country")).toBe("de");
  });

  it("omits optional params when absent", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("list_keywords")!.handler({ appId: "app-1" });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.has("sort")).toBe(false);
    expect(url.searchParams.has("country")).toBe(false);
  });

  it("maps keyword_suggestions strategy and limit", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("keyword_suggestions")!.handler({
      appId: "app-1",
      strategy: "competitors",
      limit: 5,
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/apps/app-1/keywords/suggestions");
    expect(url.searchParams.get("strategy")).toBe("competitors");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("maps keyword_breakdown to its route", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("keyword_breakdown")!.handler({
      appId: "app-1",
      keywordId: "kw-1",
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/apps/app-1/keywords/kw-1/breakdown");
    expect([...url.searchParams.keys()]).toEqual([]);
  });

  it("describes an unranked position against the field the payload carries", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    const description = tools.get("list_keywords")?.config.description;

    expect(description).toEqual(expect.any(String));
    expect(description).toContain("latestDepth");
    expect(description).toContain("latestResultCount");
    expect(description).toContain(
      "0 means the store lists no apps for the search",
    );
    expect(description).not.toMatch(/>\d+/);
  });

  it("describes a keyword that found no results through the count", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    expect(tools.get("keyword_breakdown")?.config.description).toContain(
      "resultCount 0",
    );
    expect(tools.get("keyword_discoveries")?.config.description).toContain(
      "resultCount 0",
    );
  });

  it("reads app_localizations from the localizations route", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("app_localizations")!.handler({ appId: "app-1" });

    expect(new URL(calls[0]!.url).pathname).toBe("/apps/app-1/localizations");
  });

  it("reads the target keywords of a localization", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("listing_targets")!.handler({
      appId: "a1",
      localization: "en-US",
    });

    expect(new URL(calls[0]!.url).pathname).toBe(
      "/apps/a1/localizations/en-US/targets",
    );
  });

  it("passes country to market_keyword_fields", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("market_keyword_fields")!.handler({
      appId: "app-1",
      country: "pl",
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/apps/app-1/keyword-fields/market");
    expect(url.searchParams.get("country")).toBe("pl");
  });

  it("omits country from market_keyword_fields when absent", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerCatalogTools(server, client, KEYWORD_TOOLS);

    await tools.get("market_keyword_fields")!.handler({ appId: "app-1" });

    expect(new URL(calls[0]!.url).searchParams.has("country")).toBe(false);
  });
});
