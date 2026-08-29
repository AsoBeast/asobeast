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

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetcher = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(REPORT), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getStoreHealth", () => {
  it("reads the authenticated jobs route rather than public health", async () => {
    const fetcher = stubFetch();

    await getStoreHealth();

    const [url] = fetcher.mock.calls[0] as [string];
    expect(url).toContain("/jobs/store-health");
    expect(url).not.toContain("/health?");
  });

  it("returns the report the api sent", async () => {
    stubFetch();

    await expect(getStoreHealth()).resolves.toEqual(REPORT);
  });
});
