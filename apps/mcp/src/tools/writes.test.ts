import { afterEach, describe, expect, it, vi } from "vitest";
import { MCP_WRITE_TOOLS, annotationsOf } from "@asobeast/mcp-tools";
import { createHarness, stubFetch } from "./harness.js";
import { registerCatalogTools } from "./define.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function setup(responder: Parameters<typeof stubFetch>[0]) {
  const { server, tools } = createHarness();
  const stubbed = stubFetch(responder);
  registerCatalogTools(server, stubbed.client, MCP_WRITE_TOOLS);
  return { tools, ...stubbed };
}

function textOf(result: { content: unknown[] }): string {
  return (result.content[0] as { text: string }).text;
}

describe("write tools", () => {
  it("register the five tools with the hints the catalog declares", () => {
    const { tools } = setup(() => ({ status: 200, body: {} }));

    expect([...tools.keys()]).toEqual(MCP_WRITE_TOOLS.map((tool) => tool.name));
    for (const tool of MCP_WRITE_TOOLS) {
      expect(tools.get(tool.name)?.config.annotations).toEqual(
        annotationsOf(tool),
      );
    }
  });

  it("send a tracked keyword as a post with a json body", async () => {
    const { tools, calls } = setup(() => ({
      status: 201,
      body: [
        {
          keywordId: "kw-1",
          text: "habit tracker",
          country: "us",
          active: true,
          source: "MANUAL",
        },
      ],
    }));

    const result = await tools.get("track_keywords")!.handler({
      appId: "app-1",
      keywords: ["Habit Tracker"],
      country: "us",
    });

    expect(calls[0]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ keywords: ["Habit Tracker"], country: "us" }),
    });
    expect(new URL(calls[0]!.url).pathname).toBe("/apps/app-1/keywords");
    expect(JSON.parse(textOf(result))).toEqual({
      market: "us",
      trackedInMarket: 1,
      tracked: [
        {
          keywordId: "kw-1",
          text: "habit tracker",
          active: true,
          source: "MANUAL",
        },
      ],
    });
  });

  it("say a delete that answered no body removed what it was asked to", async () => {
    const { tools, calls } = setup(() => ({ status: 204, body: null }));

    const result = await tools.get("untrack_keyword")!.handler({
      appId: "app-1",
      keywordId: "kw-1",
    });

    expect(calls[0]).toMatchObject({ method: "DELETE", body: undefined });
    expect(JSON.parse(textOf(result))).toEqual({
      removed: true,
      appId: "app-1",
      keywordId: "kw-1",
    });
  });

  it("send an action status change as a patch", async () => {
    const { tools, calls } = setup(() => ({
      status: 200,
      body: { id: "act-1", status: "DONE", evidence: { huge: true } },
    }));

    const result = await tools.get("set_action_status")!.handler({
      actionId: "act-1",
      status: "DONE",
    });

    expect(calls[0]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ status: "DONE" }),
    });
    expect(JSON.parse(textOf(result))).toMatchObject({ status: "DONE" });
    expect(textOf(result)).not.toContain("huge");
  });

  it("report a refusal as the api worded it", async () => {
    const { tools } = setup(() => ({
      status: 403,
      body: {
        statusCode: 403,
        error: "Forbidden",
        message: "competitors limit reached: 10 of 10 used",
        path: "/apps/app-1/competitors",
        timestamp: "2026-10-07T00:00:00.000Z",
      },
    }));

    const result = await tools.get("add_competitor")!.handler({
      appId: "app-1",
      url: "https://apps.apple.com/us/app/rival/id1",
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("competitors limit reached: 10 of 10 used");
  });

  it.each([
    ["untrack_keyword", { appId: "app-1", keywordId: ".." }],
    ["remove_competitor", { appId: "app-1", competitorId: "." }],
    ["set_action_status", { actionId: ".", status: "DONE" }],
  ])(
    "send nothing when %s is given a dot segment as an id",
    async (name, input) => {
      const { tools, calls } = setup(() => ({ status: 204, body: null }));

      await expect(tools.get(name)!.handler(input)).rejects.toThrow(
        "is not an id",
      );
      expect(calls).toHaveLength(0);
    },
  );

  it.each([
    ["a server error", { status: 502, body: { message: "bad gateway" } }],
    ["an api that cannot be reached", "throw" as const],
  ])(
    "say a change that failed with %s may have been applied",
    async (_case, response) => {
      const { tools } = setup(() => response);

      const result = await tools.get("remove_competitor")!.handler({
        appId: "app-1",
        competitorId: "app-2",
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("may or may not have been applied");
    },
  );
});
