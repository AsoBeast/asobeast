import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAppTools } from "./apps.js";
import { createHarness, stubFetch } from "./harness.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("app tools", () => {
  it("registers read-only tools with titles", () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 200, body: [] }));
    registerAppTools(server, client);

    for (const name of ["list_apps", "get_app", "app_summary", "portfolio"]) {
      const tool = tools.get(name);
      expect(tool).toBeDefined();
      expect(tool?.config.annotations?.readOnlyHint).toBe(true);
      expect(tool?.config.title).toBeTruthy();
    }
  });

  it("maps get_app to the right path and sends the bearer header", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({
      status: 200,
      body: { id: "app-1" },
    }));
    registerAppTools(server, client);

    const result = await tools.get("get_app")!.handler({ appId: "app-1" });

    expect(calls[0]?.url).toBe("http://localhost:4000/apps/app-1");
    expect(calls[0]?.headers.authorization).toBe("Bearer asob_secret_token");
    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toMatchObject({ type: "text" });
  });

  it("encodes an app id so it cannot escape its path segment", async () => {
    const { server, tools } = createHarness();
    const { calls, client } = stubFetch(() => ({ status: 200, body: {} }));
    registerAppTools(server, client);

    await tools.get("get_app")!.handler({ appId: "../jobs/budget" });

    expect(new URL(calls[0]!.url).pathname).toBe("/apps/..%2Fjobs%2Fbudget");
  });

  it("keeps a 204 response renderable as text", async () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({ status: 204, body: null }));
    registerAppTools(server, client);

    const result = await tools.get("list_apps")!.handler({});

    expect(result.isError).toBeUndefined();
    expect(typeof (result.content[0] as { text: string }).text).toBe("string");
  });

  it("surfaces an envelope error as an isError tool result", async () => {
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => ({
      status: 404,
      body: {
        statusCode: 404,
        error: "Not Found",
        message: "App missing not found",
        path: "/apps/missing",
        timestamp: "2026-07-24T00:00:00.000Z",
      },
    }));
    registerAppTools(server, client);

    const result = await tools.get("get_app")!.handler({ appId: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "App missing not found",
    });
  });

  it("maps a network failure to a message naming the api url", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { server, tools } = createHarness();
    const { client } = stubFetch(() => "throw");
    registerAppTools(server, client);

    const result = await tools.get("list_apps")!.handler({});

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("http://localhost:4000");
    expect(text).not.toContain("asob_secret_token");
    for (const call of stderr.mock.calls) {
      expect(String(call[0])).not.toContain("asob_secret_token");
    }
  });
});
