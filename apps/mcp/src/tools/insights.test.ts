import { afterEach, describe, expect, it, vi } from "vitest";
import { registerInsightTools } from "./insights.js";
import { createHarness, stubFetch } from "./harness.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("insight tools", () => {
  it("joins keyword ids and passes the date window for ranking_history", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerInsightTools(server, client);

    await tools.get("ranking_history")!.handler({
      appId: "app-1",
      keywordIds: ["k1", "k2"],
      from: "2026-07-01",
      to: "2026-07-24",
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/apps/app-1/rankings");
    expect(url.searchParams.get("keywordIds")).toBe("k1,k2");
    expect(url.searchParams.get("from")).toBe("2026-07-01");
    expect(url.searchParams.get("to")).toBe("2026-07-24");
  });

  it("omits keywordIds when the list is empty", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerInsightTools(server, client);

    await tools.get("ranking_history")!.handler({
      appId: "app-1",
      keywordIds: [],
    });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.has("keywordIds")).toBe(false);
  });

  it("routes serp_snapshot by keyword id with an optional date", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerInsightTools(server, client);

    await tools.get("serp_snapshot")!.handler({ keywordId: "k9" });
    await tools
      .get("serp_snapshot")!
      .handler({ keywordId: "k9", date: "2026-07-20" });

    expect(new URL(calls[0]!.url).pathname).toBe("/keywords/k9/serp");
    expect(new URL(calls[0]!.url).searchParams.has("date")).toBe(false);
    expect(new URL(calls[1]!.url).searchParams.get("date")).toBe("2026-07-20");
  });

  it("returns a version note when audit_history 404s", async () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({
      status: 404,
      body: {
        statusCode: 404,
        error: "Not Found",
        message: "Cannot GET /apps/app-1/audit/history",
        path: "/apps/app-1/audit/history",
        timestamp: "2026-07-24T00:00:00.000Z",
      },
    }));
    registerInsightTools(server, client);

    const result = await tools
      .get("audit_history")!
      .handler({ appId: "app-1" });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      "not available on this instance",
    );
  });

  it("passes review score and version filters", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerInsightTools(server, client);

    await tools.get("list_reviews")!.handler({
      appId: "app-1",
      score: 1,
      version: "2.0.0",
    });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("score")).toBe("1");
    expect(url.searchParams.get("version")).toBe("2.0.0");
  });
});
