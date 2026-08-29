import type { StoreHealthReport } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStoreHealth } from "./jobs";

const REPORT: StoreHealthReport = {
  stores: [
    {
      store: "APP_STORE",
      state: "broken",
      source: "canary",
      since: "2026-08-28T02:00:00.000Z",
      checkedAt: "2026-08-28T08:00:00.000Z",
      detail: "parsed app is missing title",
    },
  ],
  degraded: true,
};

function stubFetch(): string[] {
  const requested: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    requested.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify(REPORT), {
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

describe("getStoreHealth", () => {
  it("reads the authenticated jobs route rather than public health", async () => {
    const requested = stubFetch();

    await getStoreHealth();

    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain("/jobs/store-health");
    expect(requested[0]).not.toMatch(/\/health(\?|$)/);
  });

  it("returns the report the api sent", async () => {
    stubFetch();

    await expect(getStoreHealth()).resolves.toEqual(REPORT);
  });
});
