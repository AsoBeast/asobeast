import { afterEach, describe, expect, it, vi } from "vitest";
import { getFunnel } from "./analytics";

function stubFetch(): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    urls.push(String(input));
    return Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFunnel", () => {
  it("asks for the days and leaves the market out for every market", async () => {
    const urls = stubFetch();

    await getFunnel("app-1", 90);

    const url = new URL(urls[0]);
    expect(url.pathname).toMatch(/\/apps\/app-1\/funnel$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({ days: "90" });
  });

  it("names the market when one is picked", async () => {
    const urls = stubFetch();

    await getFunnel("app-1", 90, "pl");

    expect(new URL(urls[0]).searchParams.get("country")).toBe("pl");
  });
});
