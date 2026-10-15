import type { ChartPage } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChart } from "./charts";

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

const KEY = {
  store: "APP_STORE",
  country: "us",
  collection: "free",
  genre: "6014",
  device: "iphone",
  compare: "7d",
} as const;

describe("chart calls", () => {
  it("reads one day of a chart with every filter in the query", async () => {
    const urls = stubFetch({} as ChartPage);

    await getChart({ ...KEY, date: "2026-10-13" });

    const url = new URL(urls[0]);
    expect(url.pathname).toMatch(/\/charts$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ...KEY,
      date: "2026-10-13",
    });
  });

  it("leaves the day out to read the newest capture", async () => {
    const urls = stubFetch({} as ChartPage);

    await getChart(KEY);

    expect(new URL(urls[0]).searchParams.has("date")).toBe(false);
  });
});
