import { COMPETITOR_TOOLS } from "@asobeast/mcp-tools";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerCatalogTools } from "./define.js";
import { createHarness, stubFetch } from "./harness.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("competitor tools", () => {
  it("registers the competitor list and analysis as read only tools", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, COMPETITOR_TOOLS);

    for (const name of ["list_competitors", "competitor_analysis"]) {
      expect(tools.get(name)?.config.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("requests the competitors of the app named", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: [] }));
    registerCatalogTools(server, client, COMPETITOR_TOOLS);

    await tools.get("list_competitors")!.handler({ appId: "app-1" });
    await tools.get("competitor_analysis")!.handler({ appId: "app-1" });

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/apps/app-1/competitors",
      "/apps/app-1/competitors/analysis",
    ]);
  });
});
