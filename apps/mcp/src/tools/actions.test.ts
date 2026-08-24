import { afterEach, describe, expect, it, vi } from "vitest";
import { registerActionTools } from "./actions.js";
import { createHarness, stubFetch } from "./harness.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const ACTION_TOOLS = ["list_actions", "app_actions", "actions_summary"];

describe("action tools", () => {
  it("registers every tool as read-only", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    for (const name of ACTION_TOOLS) {
      expect(tools.get(name)?.config.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("never advertises a mutation in any description", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    for (const name of ACTION_TOOLS) {
      const description = tools.get(name)!.config.description ?? "";
      expect(description).not.toMatch(/\b(create|update|dismiss|snooze)\b/i);
      expect(description).toContain("read-only");
    }
  });

  it("teaches the domain in every description", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    for (const name of ACTION_TOOLS) {
      const description = tools.get(name)!.config.description ?? "";
      expect(description).toContain("deterministic");
      expect(description).toContain("estimate");
      expect(description).toContain("DISMISSED");
      expect(description).toContain("not comparable across stores");
    }
  });

  it("joins array filters and forwards scalars for list_actions", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    await tools.get("list_actions")!.handler({
      status: ["OPEN", "SNOOZED"],
      priority: ["critical", "high"],
      rule: ["keyword.defend"],
      category: "competition",
      appId: "app-1",
      country: "de",
      store: "GOOGLE_PLAY",
      limit: 25,
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/actions");
    expect(url.searchParams.get("status")).toBe("OPEN,SNOOZED");
    expect(url.searchParams.get("priority")).toBe("critical,high");
    expect(url.searchParams.get("rule")).toBe("keyword.defend");
    expect(url.searchParams.get("category")).toBe("competition");
    expect(url.searchParams.get("appId")).toBe("app-1");
    expect(url.searchParams.get("country")).toBe("de");
    expect(url.searchParams.get("store")).toBe("GOOGLE_PLAY");
    expect(url.searchParams.get("limit")).toBe("25");
  });

  it("omits empty array filters entirely", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    await tools.get("list_actions")!.handler({ status: [], rule: [] });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.has("rule")).toBe(false);
  });

  it("encodes an app id containing a slash", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    await tools.get("app_actions")!.handler({ appId: "app/1" });

    expect(new URL(calls[0]!.url).pathname).toBe("/apps/app%2F1/actions");
  });

  it("requests the summary without any filters", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerActionTools(server, client);

    await tools.get("actions_summary")!.handler({});

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/actions/summary");
    expect([...url.searchParams.keys()]).toEqual([]);
  });

  it("reports a clear upgrade message against an older instance", async () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({
      status: 404,
      body: { statusCode: 404, message: "Cannot GET /actions" },
    }));
    registerActionTools(server, client);

    for (const name of ACTION_TOOLS) {
      const result = await tools.get(name)!.handler({ appId: "app-1" });
      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        text: expect.stringContaining("needs a newer asobeast API"),
      });
    }
  });

  it("surfaces the api message for a non-404 failure", async () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({
      status: 402,
      body: { statusCode: 402, message: "Subscription required" },
    }));
    registerActionTools(server, client);

    const result = await tools.get("list_actions")!.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Subscription required"),
    });
  });

  it("returns valid json for an empty queue", async () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({
      status: 200,
      body: { items: [], total: 0, generatedAt: null },
    }));
    registerActionTools(server, client);

    const result = await tools.get("list_actions")!.handler({});

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({
      items: [],
      total: 0,
      generatedAt: null,
    });
  });
});
