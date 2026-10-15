import type { StoreSearchResult } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchStore } from "./apps";

function stubFetch(answer: unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    urls.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify(answer), {
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

const RESULT: StoreSearchResult = {
  storeAppId: "123456789",
  title: "Focus Timer",
  developer: "Acme",
  ratingAvg: 4.6,
  ratingCount: 1200,
  iconUrl: null,
};

describe("searchStore", () => {
  it("searches one store and storefront by name", async () => {
    const urls = stubFetch([RESULT]);

    await expect(
      searchStore("APP_STORE", "us", "focus timer"),
    ).resolves.toEqual([RESULT]);

    const url = new URL(urls[0], "http://localhost");
    expect(url.pathname).toMatch(/\/store\/search$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      store: "APP_STORE",
      country: "us",
      q: "focus timer",
    });
  });

  it("sends the limit only when one is given", async () => {
    const urls = stubFetch([]);

    await searchStore("GOOGLE_PLAY", "de", "fokus", 5);

    const url = new URL(urls[0], "http://localhost");
    expect(url.searchParams.get("store")).toBe("GOOGLE_PLAY");
    expect(url.searchParams.get("limit")).toBe("5");
  });
});
