import { afterEach, describe, expect, it, vi } from "vitest";
import { getRankings } from "./rankings";

function stubFetch(): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    urls.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify({ series: [] }), {
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

describe("getRankings", () => {
  it("sends the market as the country filter", async () => {
    const urls = stubFetch();

    await getRankings("app-1", { country: "gb" });

    expect(urls).toHaveLength(1);
    expect(
      new URL(urls[0], "http://localhost").searchParams.get("country"),
    ).toBe("gb");
  });

  it("sends no country filter without one", async () => {
    const urls = stubFetch();

    await getRankings("app-1", { keywordIds: ["kw-1"] });

    expect(urls[0]).not.toContain("country");
  });
});
