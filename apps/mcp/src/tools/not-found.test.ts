import { afterEach, describe, expect, it, vi } from "vitest";
import { MCP_TOOLS } from "@asobeast/mcp-tools";
import { createHarness, stubFetch } from "./harness.js";
import { registerTools } from "./index.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const MAPPED_TOOLS = MCP_TOOLS.filter(
  (tool) => tool.unavailableOn404 !== undefined,
);

async function answerTo404(name: string, message: string): Promise<string> {
  const { server, tools } = createHarness();
  const { client } = stubFetch(() => ({
    status: 404,
    body: {
      statusCode: 404,
      error: "Not Found",
      message,
      path: "/apps/nope",
      timestamp: "2026-09-29T00:00:00.000Z",
    },
  }));
  registerTools(server, client);

  const result = await tools
    .get(name)!
    .handler({ appId: "nope", actionId: "act-1" });

  expect(result.isError).toBe(true);
  return (result.content[0] as { text: string }).text;
}

describe("the tools that map a 404 to an upgrade note", () => {
  it("include the three the report names", () => {
    expect(MAPPED_TOOLS.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["change_impact", "app_actions", "audit_history"]),
    );
  });

  describe.each(MAPPED_TOOLS.map((tool) => [tool.name, tool] as const))(
    "%s",
    (name, tool) => {
      it("says the app was not found when the api says so", async () => {
        expect(await answerTo404(name, "App nope not found")).toBe(
          "App nope not found",
        );
      });

      it("says the action was not found when the api says so", async () => {
        expect(await answerTo404(name, "Action not found")).toBe(
          "Action not found",
        );
      });

      it("still says a newer api is needed when the route does not exist", async () => {
        expect(await answerTo404(name, "Cannot GET /apps/nope/anything")).toBe(
          tool.unavailableOn404,
        );
      });
    },
  );
});
