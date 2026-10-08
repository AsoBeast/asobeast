import { describe, expect, it } from "vitest";
import { MCP_TOOLS, requestOf, toolByName } from "./index";

describe("the tool catalog", () => {
  it("lists no write tool among the read tools", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.kind).toBe("read");
      expect(requestOf(tool, {}).method).toBe("GET");
    }
  });

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
        actionId: "act-1",
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

  it("serves no instance capacity to any caller", () => {
    expect(toolByName("daily_budget")).toBeUndefined();
    for (const tool of MCP_TOOLS) {
      expect(tool.request({}).path).not.toBe("/jobs/budget");
    }
  });

  it("returns nothing for a tool it does not define", () => {
    expect(toolByName("delete_everything")).toBeUndefined();
  });

  it("names the owner tags and note in the keyword tool summary", () => {
    const [summary] = (toolByName("list_keywords")?.description ?? "").split(
      /\.\s|\s[—–]\s/,
    );

    expect(summary).toContain("tags");
    expect(summary).toContain("note");
  });
});

describe("the market argument", () => {
  it.each(["get_app", "metadata_audit", "changes_timeline"])(
    "sends %s to one market when asked",
    (name) => {
      const request = toolByName(name)?.request({
        appId: "app-1",
        country: "de",
      });

      expect(request?.params).toMatchObject({ country: "de" });
    },
  );

  it.each(["get_app", "metadata_audit", "changes_timeline"])(
    "sends %s without a market when none is given",
    (name) => {
      const request = toolByName(name)?.request({ appId: "app-1" });

      expect(request?.params?.country).toBeUndefined();
    },
  );

  it.each(["get_app", "metadata_audit", "changes_timeline"])(
    "refuses a market that is not a lowercase two letter code for %s",
    (name) => {
      const schema = toolByName(name)?.inputSchema;

      expect(schema?.safeParse({ appId: "app-1", country: "DE" }).success).toBe(
        false,
      );
      expect(schema?.safeParse({ appId: "app-1", country: "de" }).success).toBe(
        true,
      );
    },
  );
});

describe("the get_app market", () => {
  it("promises a market listing only once one was captured", () => {
    const description = toolByName("get_app")?.description ?? "";

    expect(description).toMatch(/not found until/);
    expect(description).not.toMatch(/must be one the app tracks keywords in/);
  });
});

describe("the competitor, comparison and chart tools", () => {
  it.each([
    "list_competitors",
    "competitor_analysis",
    "keyword_comparison",
    "category_ranks",
  ])("lists %s", (name) => {
    expect(toolByName(name)).toBeDefined();
  });

  it.each([
    [
      "list_competitors",
      { appId: "app-1" },
      "/apps/app-1/competitors",
      undefined,
    ],
    [
      "competitor_analysis",
      { appId: "app-1" },
      "/apps/app-1/competitors/analysis",
      undefined,
    ],
    [
      "keyword_comparison",
      { appId: "app-1", onlyGaps: true },
      "/apps/app-1/keywords/compare",
      { onlyGaps: true },
    ],
    [
      "category_ranks",
      { appId: "app-1", from: "2026-09-01", to: "2026-09-30" },
      "/apps/app-1/category-ranks",
      { from: "2026-09-01", to: "2026-09-30" },
    ],
  ])("routes %s to its endpoint", (name, input, path, params) => {
    expect(toolByName(name)?.request(input)).toEqual(
      params === undefined ? { path } : { path, params },
    );
  });

  it("encodes an app id so it cannot escape its path segment", () => {
    expect(
      toolByName("list_competitors")?.request({ appId: "../jobs/budget" }).path,
    ).toBe("/apps/..%2Fjobs%2Fbudget/competitors");
  });
});
