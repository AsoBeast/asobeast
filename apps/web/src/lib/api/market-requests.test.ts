import { afterEach, describe, expect, it, vi } from "vitest";
import { getApp } from "./apps";
import { getChanges } from "./changes";
import { refreshApp } from "./jobs";
import { getMetadataAudit } from "./metadata";

function stubFetch(): string[] {
  const requested: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    requested.push(String(input));
    return Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return requested;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("market aware calls", () => {
  it("asks for a market listing only when a market is named", async () => {
    const requested = stubFetch();

    await getApp("app-1");
    await getApp("app-1", "de");

    expect(requested[0]).toMatch(/\/apps\/app-1$/);
    expect(requested[1]).toMatch(/\/apps\/app-1\?country=de$/);
  });

  it("audits the market it is given", async () => {
    const requested = stubFetch();

    await getMetadataAudit("app-1", "de");

    expect(requested[0]).toMatch(/\/apps\/app-1\/metadata\/audit\?country=de$/);
  });

  it("lists the changes of a market next to the window", async () => {
    const requested = stubFetch();

    await getChanges("app-1", 30, "de");
    await getChanges("app-1", 30);

    expect(requested[0]).toMatch(/\/apps\/app-1\/changes\?days=30&country=de$/);
    expect(requested[1]).toMatch(/\/apps\/app-1\/changes\?days=30$/);
  });

  it("refreshes the market it is given", async () => {
    const requested = stubFetch();

    await refreshApp("app-1", "de");
    await refreshApp("app-1");

    expect(requested[0]).toMatch(/\/apps\/app-1\/refresh\?country=de$/);
    expect(requested[1]).toMatch(/\/apps\/app-1\/refresh$/);
  });
});
