import { afterEach, describe, expect, it, vi } from "vitest";
import { registerKeywordTools } from "./keywords.js";
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
    registerKeywordTools(server, client);

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
    registerKeywordTools(server, client);

    await tools.get("list_keywords")!.handler({ appId: "app-1" });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.has("sort")).toBe(false);
    expect(url.searchParams.has("country")).toBe(false);
  });

  it("maps keyword_suggestions strategy and limit", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: [] }));
    registerKeywordTools(server, client);

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

  it("describes an unranked position against the field the payload carries", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: [] }));
    registerKeywordTools(server, client);

    const description = tools.get("list_keywords")?.config.description;

    expect(description).toEqual(expect.any(String));
    expect(description).toContain("latestDepth");
    expect(description).not.toMatch(/>\d+/);
  });
});
