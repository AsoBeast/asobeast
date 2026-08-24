import { describe, expect, it } from "vitest";
import { MCP_TOOLS, toolByName } from "./index";

describe("the tool catalog", () => {
  it("names every tool once", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a title, a description and a schema", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("routes every tool at a path under the api root", () => {
    for (const tool of MCP_TOOLS) {
      const { path } = tool.request({
        appId: "app-1",
        keywordId: "kw-1",
        strategy: "metadata",
      });
      expect(path.startsWith("/")).toBe(true);
    }
  });

  it("encodes an id so it cannot escape its path segment", () => {
    const tool = toolByName("get_app");

    expect(tool?.request({ appId: "../jobs/budget" }).path).toBe(
      "/apps/..%2Fjobs%2Fbudget",
    );
  });

  it("returns nothing for a tool it does not define", () => {
    expect(toolByName("delete_everything")).toBeUndefined();
  });
});
