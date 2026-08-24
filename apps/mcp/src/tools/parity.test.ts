import { afterEach, describe, expect, it, vi } from "vitest";
import { MCP_TOOLS } from "@asobeast/mcp-tools";
import { createHarness, stubFetch } from "./harness.js";
import { registerTools } from "./index.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function registered() {
  const { server, tools } = createHarness();
  const { client, calls } = stubFetch(() => ({ status: 200, body: {} }));
  registerTools(server, client);
  return { tools, calls };
}

describe("stdio transport parity", () => {
  it("registers exactly the shared catalog, once each", () => {
    const { tools } = registered();

    expect([...tools.keys()].sort()).toEqual(
      MCP_TOOLS.map((tool) => tool.name).sort(),
    );
  });

  it("carries the catalog title and description onto every tool", () => {
    const { tools } = registered();

    for (const tool of MCP_TOOLS) {
      expect(tools.get(tool.name)?.config).toMatchObject({
        title: tool.title,
        description: tool.description,
        annotations: { readOnlyHint: true },
      });
    }
  });

  it("requests the path the catalog declares", async () => {
    const { tools, calls } = registered();

    await tools.get("app_summary")!.handler({ appId: "app-1" });

    expect(new URL(calls[0]!.url).pathname).toBe("/apps/app-1/summary");
  });
});
